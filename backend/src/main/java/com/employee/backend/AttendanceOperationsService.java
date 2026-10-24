package com.employee.backend;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Locale;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AttendanceOperationsService {

    private final AttendanceHolidayRepository holidayRepository;
    private final AttendanceLeaveRequestRepository leaveRepository;
    private final AttendanceCorrectionRequestRepository correctionRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final UserAccountRepository userRepository;
    private final OfficeGeofence officeGeofence;
    private final ActivityService activityService;

    public AttendanceOperationsService(
            AttendanceHolidayRepository holidayRepository,
            AttendanceLeaveRequestRepository leaveRepository,
            AttendanceCorrectionRequestRepository correctionRepository,
            AttendanceRecordRepository attendanceRepository,
            UserAccountRepository userRepository,
            OfficeGeofence officeGeofence,
            ActivityService activityService) {
        this.holidayRepository = holidayRepository;
        this.leaveRepository = leaveRepository;
        this.correctionRepository = correctionRepository;
        this.attendanceRepository = attendanceRepository;
        this.userRepository = userRepository;
        this.officeGeofence = officeGeofence;
        this.activityService = activityService;
    }

    @Transactional(readOnly = true)
    public List<HolidayResponse> getHolidays(LocalDate from, LocalDate through) {
        return holidayRepository.findAllByDateBetweenOrderByDateAsc(from, through)
                .stream()
                .map(holiday -> new HolidayResponse(
                        holiday.getId(), holiday.getDate(), holiday.getName()))
                .toList();
    }

    @Transactional
    public HolidayResponse addHoliday(HolidayRequest request, Long actorId) {
        UserAccount actor = requireHr(actorId);
        if (request == null || request.date() == null
                || request.name() == null || request.name().isBlank()
                || request.name().trim().length() > 120) {
            throw badRequest("Enter a holiday date and name.");
        }
        if (holidayRepository.existsByDate(request.date())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "A holiday already exists for that date.");
        }
        AttendanceHoliday holiday = holidayRepository.save(
                new AttendanceHoliday(request.date(), request.name().trim()));
        activityService.record(actor, "ATTENDANCE_HOLIDAY_ADDED",
                "Added holiday " + holiday.getName() + " on " + holiday.getDate());
        return new HolidayResponse(holiday.getId(), holiday.getDate(), holiday.getName());
    }

    @Transactional
    public void deleteHoliday(Long holidayId, Long actorId) {
        UserAccount actor = requireHr(actorId);
        AttendanceHoliday holiday = holidayRepository.findById(holidayId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Holiday was not found."));
        holidayRepository.delete(holiday);
        activityService.record(actor, "ATTENDANCE_HOLIDAY_REMOVED",
                "Removed holiday " + holiday.getName() + " on " + holiday.getDate());
    }

    @Transactional(readOnly = true)
    public List<LeaveResponse> getLeaveRequests(Long requesterId, Long employeeId) {
        UserAccount requester = requireUser(requesterId);
        boolean hr = isHrOrAdmin(requester.getRole());
        if (!hr && employeeId != null && !employeeId.equals(requesterId)) {
            throw forbidden();
        }
        List<AttendanceLeaveRequest> requests = hr
                ? employeeId == null
                        ? leaveRepository.findAllByOrderByCreatedAtDesc()
                        : leaveRepository.findAllByUser_IdOrderByCreatedAtDesc(employeeId)
                : leaveRepository.findAllByUser_IdOrderByCreatedAtDesc(requesterId);
        return requests.stream().map(this::toLeaveResponse).toList();
    }

    @Transactional
    public LeaveResponse requestLeave(Long employeeId, LeaveRequest request) {
        UserAccount employee = requireUser(employeeId);
        if (request == null || request.startDate() == null || request.endDate() == null
                || request.reason() == null || request.reason().isBlank()
                || request.reason().trim().length() > 500
                || request.startDate().isAfter(request.endDate())
                || request.startDate().isBefore(LocalDate.now(zoneId()))) {
            throw badRequest("Enter a valid future leave date range and reason.");
        }
        if (request.startDate().plusDays(31).isBefore(request.endDate())) {
            throw badRequest("A leave request cannot exceed 32 calendar days.");
        }
        if (leaveRepository
                .existsByUser_IdAndStatusInAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                        employeeId,
                        List.of("PENDING", "APPROVED"),
                        request.endDate(),
                        request.startDate())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "You already have a pending or approved leave request overlapping these dates.");
        }
        AttendanceLeaveRequest saved = leaveRepository.save(
                new AttendanceLeaveRequest(
                        employee,
                        request.startDate(),
                        request.endDate(),
                        request.reason().trim()));
        if ("ADMIN".equalsIgnoreCase(employee.getRole())) {
            saved.decide("APPROVED", employee, LocalDateTime.now(zoneId()));
            activityService.record(employee, "ATTENDANCE_LEAVE_APPROVED",
                    "Admin self-approved leave from " + saved.getStartDate()
                            + " through " + saved.getEndDate());
        } else {
            activityService.record(employee, "ATTENDANCE_LEAVE_REQUESTED",
                    "Requested leave from " + saved.getStartDate() + " through "
                            + saved.getEndDate());
        }
        return toLeaveResponse(saved);
    }

    @Transactional
    public LeaveResponse decideLeave(
            Long requestId, DecisionRequest request, Long reviewerId) {
        UserAccount reviewer = requireHr(reviewerId);
        AttendanceLeaveRequest leave = leaveRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Leave request was not found."));
        String decision = requireDecision(request);
        if (leave.getUser().getId().equals(reviewerId)) {
            throw forbidden();
        }
        if (!"PENDING".equals(leave.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "This leave request has already been reviewed.");
        }
        leave.decide(decision, reviewer, LocalDateTime.now(zoneId()));
        activityService.record(reviewer, "ATTENDANCE_LEAVE_" + decision,
                decision.toLowerCase() + " leave request #" + requestId
                        + " for " + leave.getUser().getFullName()
                        + " (" + leave.getStartDate() + " to " + leave.getEndDate() + ")");
        return toLeaveResponse(leave);
    }

    @Transactional(readOnly = true)
    public List<CorrectionResponse> getCorrectionRequests(
            Long requesterId, Long employeeId) {
        UserAccount requester = requireUser(requesterId);
        boolean hr = isHrOrAdmin(requester.getRole());
        if (!hr && employeeId != null && !employeeId.equals(requesterId)) {
            throw forbidden();
        }
        List<AttendanceCorrectionRequest> requests = hr
                ? employeeId == null
                        ? correctionRepository.findAllByOrderByCreatedAtDesc()
                        : correctionRepository.findAllByUser_IdOrderByCreatedAtDesc(employeeId)
                : correctionRepository.findAllByUser_IdOrderByCreatedAtDesc(requesterId);
        return requests.stream().map(this::toCorrectionResponse).toList();
    }

    @Transactional
    public CorrectionResponse requestCorrection(
            Long employeeId, CorrectionRequest request) {
        UserAccount employee = requireUser(employeeId);
        LocalDate today = LocalDate.now(zoneId());
        if (request == null || request.workDate() == null
                || request.workDate().isAfter(today)
                || request.reason() == null || request.reason().isBlank()
                || request.reason().trim().length() > 500
                || request.requestedClockIn() == null
                || !request.workDate().equals(request.requestedClockIn().toLocalDate())
                || request.requestedClockIn().isAfter(LocalDateTime.now(zoneId()))
                || (request.requestedClockOut() != null
                && (!request.workDate().equals(request.requestedClockOut().toLocalDate())
                || !request.requestedClockOut().isAfter(request.requestedClockIn())
                || request.requestedClockOut().isAfter(LocalDateTime.now(zoneId()))))) {
            throw badRequest("Enter a valid past or current work date, clock-in, optional later clock-out, and reason.");
        }
        AttendanceCorrectionRequest saved = correctionRepository.save(
                new AttendanceCorrectionRequest(
                        employee,
                        request.workDate(),
                        request.requestedClockIn(),
                        request.requestedClockOut(),
                        request.reason().trim()));
        if ("ADMIN".equalsIgnoreCase(employee.getRole())) {
            String originalTimes = applyCorrection(saved);
            saved.decide("APPROVED", employee, LocalDateTime.now(zoneId()));
            activityService.record(employee, "ATTENDANCE_CORRECTION_APPROVED",
                    "Admin self-approved correction for account "
                            + employee.getId() + " on " + saved.getWorkDate()
                            + "; previous " + originalTimes
                            + "; requested clock-in " + saved.getRequestedClockIn()
                            + ", clock-out " + saved.getRequestedClockOut());
        } else {
            activityService.record(employee, "ATTENDANCE_CORRECTION_REQUESTED",
                    "Requested attendance correction for " + request.workDate());
        }
        return toCorrectionResponse(saved);
    }

    @Transactional
    public CorrectionResponse decideCorrection(
            Long requestId, DecisionRequest request, Long reviewerId) {
        UserAccount reviewer = requireHr(reviewerId);
        AttendanceCorrectionRequest correction = correctionRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Correction request was not found."));
        String decision = requireDecision(request);
        if (correction.getUser().getId().equals(reviewerId)) {
            throw forbidden();
        }
        if (!"PENDING".equals(correction.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "This correction request has already been reviewed.");
        }
        String originalTimes = "No existing punch";
        if ("APPROVED".equals(decision)) originalTimes = applyCorrection(correction);
        correction.decide(decision, reviewer, LocalDateTime.now(zoneId()));
        activityService.record(reviewer, "ATTENDANCE_CORRECTION_" + decision,
                decision.toLowerCase() + " correction #" + requestId
                        + " for account " + correction.getUser().getId()
                        + " on " + correction.getWorkDate()
                        + "; previous " + originalTimes
                        + "; requested clock-in " + correction.getRequestedClockIn()
                        + ", clock-out " + correction.getRequestedClockOut());
        return toCorrectionResponse(correction);
    }

    @Transactional(readOnly = true)
    public CalendarData getCalendar(LocalDate from, LocalDate through) {
        List<AttendanceHoliday> holidays =
                holidayRepository.findAllByDateBetweenOrderByDateAsc(from, through);
        List<AttendanceLeaveRequest> approvedLeaves =
                leaveRepository
                        .findAllByStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                                "APPROVED", through, from);
        List<AttendanceCorrectionRequest> pendingCorrections =
                correctionRepository.findAllByStatusAndWorkDateBetween(
                        "PENDING", from, through);
        return new CalendarData(holidays, approvedLeaves, pendingCorrections);
    }

    private String applyCorrection(AttendanceCorrectionRequest correction) {
        AttendanceRecord existing = attendanceRepository
                .findByUser_IdAndWorkDate(
                        correction.getUser().getId(), correction.getWorkDate())
                .orElse(null);
        String originalTimes = existing == null
                ? "No existing punch"
                : "clock-in " + existing.getClockIn() + ", clock-out " + existing.getClockOut();
        AttendanceRecord record = existing == null
                ? new AttendanceRecord(
                        correction.getUser(),
                        correction.getWorkDate(),
                        correction.getRequestedClockIn())
                : existing;
        record.setClockIn(correction.getRequestedClockIn());
        if (correction.getRequestedClockOut() != null || existing == null) {
            record.setClockOut(correction.getRequestedClockOut());
        }
        attendanceRepository.save(record);
        return originalTimes;
    }

    private String requireDecision(DecisionRequest request) {
        if (request == null || request.decision() == null
                || !List.of("APPROVED", "REJECTED").contains(
                        request.decision().toUpperCase(Locale.ROOT))) {
            throw badRequest("Choose APPROVED or REJECTED.");
        }
        return request.decision().toUpperCase(Locale.ROOT);
    }

    private LeaveResponse toLeaveResponse(AttendanceLeaveRequest request) {
        return new LeaveResponse(
                request.getId(),
                request.getUser().getId(),
                request.getUser().getFullName(),
                request.getStartDate(),
                request.getEndDate(),
                request.getReason(),
                request.getStatus(),
                request.getReviewer() == null ? null : request.getReviewer().getFullName(),
                request.getReviewedAt());
    }

    private CorrectionResponse toCorrectionResponse(
            AttendanceCorrectionRequest request) {
        return new CorrectionResponse(
                request.getId(),
                request.getUser().getId(),
                request.getUser().getFullName(),
                request.getWorkDate(),
                request.getRequestedClockIn(),
                request.getRequestedClockOut(),
                request.getReason(),
                request.getStatus(),
                request.getReviewer() == null ? null : request.getReviewer().getFullName(),
                request.getReviewedAt());
    }

    private ZoneId zoneId() {
        return ZoneId.of(officeGeofence.getOfficeLocation().timeZone());
    }

    private UserAccount requireHr(Long userId) {
        UserAccount actor = requireUser(userId);
        if (!isHrOrAdmin(actor.getRole())) throw forbidden();
        return actor;
    }

    private UserAccount requireUser(Long userId) {
        if (userId == null) throw badRequest("An account ID is required.");
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User account was not found."));
    }

    private boolean isHrOrAdmin(String role) {
        return "ADMIN".equalsIgnoreCase(role) || "HR_MANAGER".equalsIgnoreCase(role);
    }

    private ResponseStatusException forbidden() {
        return new ResponseStatusException(
                HttpStatus.FORBIDDEN, "Only HR and Admin can perform this action.");
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record HolidayRequest(LocalDate date, String name) {}
    public record HolidayResponse(Long id, LocalDate date, String name) {}
    public record LeaveRequest(LocalDate startDate, LocalDate endDate, String reason) {}
    public record DecisionRequest(String decision) {}
    public record LeaveResponse(
            Long id,
            Long accountId,
            String employeeName,
            LocalDate startDate,
            LocalDate endDate,
            String reason,
            String status,
            String reviewerName,
            LocalDateTime reviewedAt) {}
    public record CorrectionRequest(
            LocalDate workDate,
            LocalDateTime requestedClockIn,
            LocalDateTime requestedClockOut,
            String reason) {}
    public record CorrectionResponse(
            Long id,
            Long accountId,
            String employeeName,
            LocalDate workDate,
            LocalDateTime requestedClockIn,
            LocalDateTime requestedClockOut,
            String reason,
            String status,
            String reviewerName,
            LocalDateTime reviewedAt) {}
    public record CalendarData(
            List<AttendanceHoliday> holidays,
            List<AttendanceLeaveRequest> approvedLeaves,
            List<AttendanceCorrectionRequest> pendingCorrections) {}
}
