package com.employee.backend;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.time.format.DateTimeFormatter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AttendanceService {

    private final AttendanceRecordRepository attendanceRepository;
    private final UserAccountRepository userRepository;
    private final ActivityService activityService;
    private final OfficeGeofence officeGeofence;
    private final AttendanceOperationsService attendanceOperationsService;

    public AttendanceService(
            AttendanceRecordRepository attendanceRepository,
            UserAccountRepository userRepository,
            ActivityService activityService,
            OfficeGeofence officeGeofence,
            AttendanceOperationsService attendanceOperationsService) {
        this.attendanceRepository = attendanceRepository;
        this.userRepository = userRepository;
        this.activityService = activityService;
        this.officeGeofence = officeGeofence;
        this.attendanceOperationsService = attendanceOperationsService;
    }

    @Transactional(readOnly = true)
    public Optional<AttendanceResponse> getToday(Long accountId) {
        UserAccount user = getUser(accountId);
        ZoneId zoneId = zoneId();
        return attendanceRepository
                .findByUser_IdAndWorkDate(accountId, LocalDate.now(zoneId))
                .map(record -> AttendanceResponse.from(record, user, zoneId));
    }

    @Transactional(readOnly = true)
    public OfficeGeofence.OfficeLocationResponse getOfficeLocation() {
        return officeGeofence.getOfficeLocation();
    }

    @Transactional
    public OfficeGeofence.OfficeLocationResponse saveOfficeLocation(
            OfficeGeofence.OfficeLocationRequest location,
            Long actorId) {
        OfficeGeofence.OfficeLocationResponse saved =
                officeGeofence.saveOfficeLocation(location);
        UserAccount actor = getUser(actorId);
        activityService.record(actor, "ATTENDANCE_POLICY_UPDATED",
                "Updated office policy: radius " + saved.radiusMeters() + " m, "
                        + saved.timeZone() + ", " + saved.shiftStart() + "-"
                        + saved.shiftEnd() + ", " + saved.graceMinutes()
                        + " min grace; workdays " + saved.workDays());
        return saved;
    }

    @Transactional
    public AttendanceResponse clockIn(
            Long accountId,
            AttendanceController.AttendanceLocation location) {
        OfficeGeofence.LocationVerification verification = officeGeofence.validate(
                location == null ? null : location.latitude(),
                location == null ? null : location.longitude(),
                location == null ? null : location.accuracyMeters());
        UserAccount user = getUser(accountId);
        ZoneId zoneId = zoneId();
        LocalDate today = LocalDate.now(zoneId);

        if (attendanceRepository.findByUser_IdAndWorkDate(accountId, today).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "You have already recorded attendance for today.");
        }

        try {
            AttendanceRecord saved = attendanceRepository.save(
                    new AttendanceRecord(user, today, LocalDateTime.now(zoneId)));
            activityService.record(
                    user,
                    "ATTENDANCE_CLOCK_IN",
                    "Clocked in at " + saved.getClockIn()
                            .format(DateTimeFormatter.ofPattern("h:mm a"))
                            + "; location verified "
                            + Math.round(verification.distanceMeters())
                            + " m from office (reported accuracy +/-"
                            + Math.round(verification.accuracyMeters()) + " m)");
            return AttendanceResponse.from(saved, user, zoneId);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "You have already recorded attendance for today.",
                    exception);
        }
    }

    @Transactional
    public AttendanceResponse clockOut(
            Long accountId,
            AttendanceController.AttendanceLocation location) {
        OfficeGeofence.LocationVerification verification = officeGeofence.validate(
                location == null ? null : location.latitude(),
                location == null ? null : location.longitude(),
                location == null ? null : location.accuracyMeters());
        UserAccount user = getUser(accountId);
        ZoneId zoneId = zoneId();
        AttendanceRecord record = attendanceRepository
                .findByUser_IdAndWorkDate(accountId, LocalDate.now(zoneId))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Clock in before recording a clock-out."));

        if (record.getClockOut() != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "You have already clocked out for today.");
        }

        record.setClockOut(LocalDateTime.now(zoneId));
        AttendanceRecord saved = attendanceRepository.save(record);
        activityService.record(
                user,
                "ATTENDANCE_CLOCK_OUT",
                "Clocked out at " + saved.getClockOut()
                        .format(DateTimeFormatter.ofPattern("h:mm a"))
                        + "; location verified "
                        + Math.round(verification.distanceMeters())
                        + " m from office (reported accuracy +/-"
                        + Math.round(verification.accuracyMeters()) + " m)");
        return AttendanceResponse.from(saved, user, zoneId);
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> getCompanyAttendance(Long requesterId) {
        UserAccount requester = getUser(requesterId);
        if (!isHrOrAdmin(requester.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only HR and Admin users can view company attendance.");
        }

        ZoneId zoneId = zoneId();
        return attendanceRepository.findAllByOrderByWorkDateDescClockInDesc()
                .stream()
                .map(record -> AttendanceResponse.from(record, record.getUser(), zoneId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> getUserHistory(Long accountId) {
        UserAccount user = getUser(accountId);
        ZoneId zoneId = zoneId();
        return attendanceRepository
                .findAllByUser_IdOrderByWorkDateDescClockInDesc(accountId)
                .stream()
                .map(record -> AttendanceResponse.from(record, user, zoneId))
                .toList();
    }

    @Transactional(readOnly = true)
    public AttendanceReport getReport(
            LocalDate fromDate,
            LocalDate throughDate,
            Long employeeAccountId) {
        OfficeGeofence.OfficeLocationResponse policy = officeGeofence.getOfficeLocation();
        ZoneId zoneId = ZoneId.of(policy.timeZone());
        LocalDate today = LocalDate.now(zoneId);
        LocalTime currentTime = LocalTime.now(zoneId);
        if (fromDate == null || throughDate == null || fromDate.isAfter(throughDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Choose a valid attendance date range.");
        }
        if (throughDate.isAfter(today)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Attendance reports cannot include future dates.");
        }
        if (fromDate.plusDays(31).isBefore(throughDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Attendance reports are limited to 32 calendar days.");
        }

        List<UserAccount> accounts = employeeAccountId == null
                ? userRepository.findAllByOrderByFullNameAsc()
                : List.of(getUser(employeeAccountId));
        List<AttendanceRecord> existingRecords = employeeAccountId == null
                ? attendanceRepository
                        .findAllByWorkDateBetweenOrderByWorkDateDescClockInDesc(
                                fromDate, throughDate)
                : attendanceRepository
                        .findAllByUser_IdAndWorkDateBetweenOrderByWorkDateDescClockInDesc(
                                employeeAccountId, fromDate, throughDate);
        Map<String, AttendanceRecord> recordsByDateAndAccount =
                existingRecords.stream().collect(Collectors.toMap(
                        record -> record.getWorkDate() + ":" + record.getUser().getId(),
                        Function.identity(),
                        (first, ignored) -> first));

        AttendanceOperationsService.CalendarData calendar =
                attendanceOperationsService.getCalendar(fromDate, throughDate);
        Map<LocalDate, AttendanceHoliday> holidays = calendar.holidays().stream()
                .collect(Collectors.toMap(AttendanceHoliday::getDate, Function.identity()));
        List<AttendanceLeaveRequest> approvedLeaves = calendar.approvedLeaves();
        Set<String> workingDays = Set.of(policy.workDays().split(","));
        Set<String> pendingCorrectionKeys = calendar.pendingCorrections().stream()
                .map(request -> request.getUser().getId() + ":" + request.getWorkDate())
                .collect(Collectors.toSet());

        List<DailyAttendance> days = accounts.stream()
                .flatMap(account -> fromDate.datesUntil(throughDate.plusDays(1))
                        .filter(date -> account.getCreatedAt() == null
                                || !date.isBefore(account.getCreatedAt().toLocalDate()))
                        .filter(date -> !date.isAfter(today))
                        .filter(date -> isScheduledWorkday(date, workingDays)
                                || holidays.containsKey(date)
                                || (isScheduledWorkday(date, workingDays)
                                && isApprovedLeave(account.getId(), date, approvedLeaves))
                                || pendingCorrectionKeys.contains(
                                        account.getId() + ":" + date)
                                || recordsByDateAndAccount.containsKey(
                                        date + ":" + account.getId()))
                        .map(date -> reportDay(
                                account,
                                date,
                                today,
                                currentTime,
                                recordsByDateAndAccount,
                                holidays,
                                approvedLeaves,
                                pendingCorrectionKeys,
                                policy,
                                zoneId)))
                .sorted((left, right) -> {
                    int dateOrder = right.workDate().compareTo(left.workDate());
                    return dateOrder != 0
                            ? dateOrder
                            : left.fullName().compareToIgnoreCase(right.fullName());
                })
                .toList();

        int scheduledDays = (int) days.stream()
                .filter(day -> isScheduledWorkday(day.workDate(), workingDays)
                        && !holidays.containsKey(day.workDate())
                        && !isApprovedLeave(day.accountId(), day.workDate(), approvedLeaves))
                .count();
        int presentDays = (int) days.stream()
                .filter(day -> day.status().equals("PRESENT")
                        || day.status().equals("IN_PROGRESS"))
                .count();
        int partialDays = (int) days.stream()
                .filter(day -> day.status().equals("PARTIAL"))
                .count();
        int absentDays = (int) days.stream()
                .filter(day -> day.status().equals("ABSENT"))
                .count();
        int inProgressDays = (int) days.stream()
                .filter(day -> day.status().equals("IN_PROGRESS"))
                .count();
        int holidayDays = (int) days.stream()
                .filter(day -> day.status().equals("HOLIDAY"))
                .count();
        int leaveDays = (int) days.stream()
                .filter(day -> day.status().equals("LEAVE"))
                .count();
        int reviewDays = (int) days.stream()
                .filter(day -> day.status().equals("REVIEW")
                        || day.status().equals("INCOMPLETE"))
                .count();
        long workedMinutes = days.stream()
                .mapToLong(day -> day.workedMinutes() == null ? 0 : day.workedMinutes())
                .sum();

        List<EmployeeOption> employees = userRepository.findAllByOrderByFullNameAsc()
                .stream()
                .map(account -> new EmployeeOption(
                        account.getId(), account.getFullName(), account.getUsername()))
                .toList();

        return new AttendanceReport(
                fromDate,
                throughDate,
                employeeAccountId,
                employees,
                days,
                scheduledDays,
                presentDays,
                partialDays,
                absentDays,
                inProgressDays,
                workedMinutes,
                holidayDays,
                leaveDays,
                reviewDays,
                policy.timeZone(),
                policy.shiftStart(),
                policy.shiftEnd(),
                policy.graceMinutes());
    }

    private DailyAttendance reportDay(
            UserAccount account,
            LocalDate date,
            LocalDate today,
            LocalTime currentTime,
            Map<String, AttendanceRecord> recordsByDateAndAccount,
            Map<LocalDate, AttendanceHoliday> holidays,
            List<AttendanceLeaveRequest> approvedLeaves,
            Set<String> pendingCorrectionKeys,
            OfficeGeofence.OfficeLocationResponse policy,
            ZoneId zoneId) {
        AttendanceRecord record =
                recordsByDateAndAccount.get(date + ":" + account.getId());
        boolean holiday = holidays.containsKey(date);
        boolean leave = isApprovedLeave(account.getId(), date, approvedLeaves);
        boolean pendingCorrection = pendingCorrectionKeys.contains(
                account.getId() + ":" + date);
        String status;
        String detail = null;
        if (record != null) {
            status = classifyAttendance(record, date, today, currentTime, policy);
            if (holiday) detail = "Worked on holiday: " + holidays.get(date).getName();
            if (leave) detail = "Attendance recorded during approved leave";
        } else if (holiday) {
            status = "HOLIDAY";
            detail = holidays.get(date).getName();
        } else if (leave && isScheduledWorkday(date, Set.of(policy.workDays().split(",")))) {
            status = "LEAVE";
            detail = "Approved leave";
        } else {
            status = date.isBefore(today)
                    || (date.equals(today)
                    && currentTime.isAfter(policy.shiftEnd()
                            .plusMinutes(policy.graceMinutes())))
                    ? "ABSENT"
                    : "NOT_STARTED";
        }
        if (pendingCorrection) {
            status = "REVIEW";
            detail = "Attendance correction awaiting review";
        } else if ("INCOMPLETE".equals(status)) {
            detail = "Clock-out is missing; review this shift";
        } else if ("PARTIAL".equals(status)) {
            detail = "Clock times are outside the scheduled shift";
        }
        Long minutes = record == null || record.getClockOut() == null
                ? null
                : Duration.between(record.getClockIn(), record.getClockOut()).toMinutes();
        return new DailyAttendance(
                account.getId(),
                account.getFullName(),
                account.getUsername(),
                date,
                record == null ? null : record.getClockIn().atZone(zoneId).toOffsetDateTime(),
                record == null || record.getClockOut() == null
                        ? null : record.getClockOut().atZone(zoneId).toOffsetDateTime(),
                minutes,
                status,
                detail);
    }

    private String classifyAttendance(
            AttendanceRecord record,
            LocalDate workDate,
            LocalDate today,
            LocalTime currentTime,
            OfficeGeofence.OfficeLocationResponse policy) {
        LocalTime clockIn = record.getClockIn().toLocalTime();
        LocalTime latestGraceClockIn = policy.shiftStart()
                .plusMinutes(policy.graceMinutes());
        LocalTime earliestGraceClockOut = policy.shiftEnd()
                .minusMinutes(policy.graceMinutes());

        if (record.getClockOut() == null) {
            if (workDate.isBefore(today)) return "INCOMPLETE";
            if (workDate.equals(today)
                    && currentTime.isAfter(policy.shiftEnd()
                            .plusMinutes(policy.graceMinutes()))) {
                return "INCOMPLETE";
            }
            return "IN_PROGRESS";
        }

        LocalTime clockOut = record.getClockOut().toLocalTime();
        if (clockIn.isAfter(latestGraceClockIn)
                || clockOut.isBefore(earliestGraceClockOut)) {
            return "PARTIAL";
        }
        return "PRESENT";
    }

    private boolean isScheduledWorkday(LocalDate date, Set<String> workingDays) {
        return workingDays.contains(date.getDayOfWeek().name());
    }

    private boolean isApprovedLeave(
            Long accountId,
            LocalDate date,
            List<AttendanceLeaveRequest> approvedLeaves) {
        return approvedLeaves.stream()
                .anyMatch(leave -> leave.getUser().getId().equals(accountId)
                        && !date.isBefore(leave.getStartDate())
                        && !date.isAfter(leave.getEndDate()));
    }

    private ZoneId zoneId() {
        return ZoneId.of(officeGeofence.getOfficeLocation().timeZone());
    }

    private UserAccount getUser(Long accountId) {
        if (accountId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "An account ID is required.");
        }
        return userRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User account was not found."));
    }

    private boolean isHrOrAdmin(String role) {
        return "ADMIN".equalsIgnoreCase(role)
                || "HR_MANAGER".equalsIgnoreCase(role);
    }

    public record AttendanceResponse(
            Long id,
            Long accountId,
            String fullName,
            String username,
            LocalDate workDate,
            OffsetDateTime clockIn,
            OffsetDateTime clockOut,
            Long workedMinutes) {

        static AttendanceResponse from(
                AttendanceRecord record,
                UserAccount user,
                ZoneId zoneId) {
            Long workedMinutes = record.getClockOut() == null
                    ? null
                    : Duration.between(
                            record.getClockIn(),
                            record.getClockOut()).toMinutes();
            return new AttendanceResponse(
                    record.getId(),
                    user.getId(),
                    user.getFullName(),
                    user.getUsername(),
                    record.getWorkDate(),
                    record.getClockIn().atZone(zoneId).toOffsetDateTime(),
                    record.getClockOut() == null ? null
                            : record.getClockOut().atZone(zoneId).toOffsetDateTime(),
                    workedMinutes);
        }
    }

    public record EmployeeOption(Long accountId, String fullName, String username) {}

        public record DailyAttendance(
                Long accountId,
                String fullName,
                String username,
                LocalDate workDate,
                OffsetDateTime clockIn,
                OffsetDateTime clockOut,
                Long workedMinutes,
                String status,
                String detail) {}

        public record AttendanceReport(
                LocalDate fromDate,
                LocalDate throughDate,
                Long selectedEmployeeId,
                List<EmployeeOption> employees,
                List<DailyAttendance> days,
                int scheduledDays,
                int presentDays,
                int partialDays,
                int absentDays,
                int inProgressDays,
                long workedMinutes,
                int holidayDays,
                int leaveDays,
                int reviewDays,
                String timeZone,
                LocalTime shiftStart,
                LocalTime shiftEnd,
                int graceMinutes) {}
}
