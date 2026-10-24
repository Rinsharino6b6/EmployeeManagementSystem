package com.employee.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.mock;

class AttendanceServiceTest {

    private AttendanceRecordRepository attendanceRepository;
    private UserAccountRepository userRepository;
    private ActivityService activityService;
    private OfficeGeofence officeGeofence;
    private AttendanceOperationsService attendanceOperationsService;
    private AttendanceService attendanceService;
    private UserAccount user;

    @BeforeEach
    void setUp() {
        attendanceRepository = mock(AttendanceRecordRepository.class);
        userRepository = mock(UserAccountRepository.class);
        activityService = mock(ActivityService.class);
        officeGeofence = mock(OfficeGeofence.class);
        attendanceOperationsService = mock(AttendanceOperationsService.class);
        when(officeGeofence.validate(
                any(Double.class), any(Double.class), any(Double.class)))
                .thenReturn(new OfficeGeofence.LocationVerification(5.0, 10.0));
        when(officeGeofence.getOfficeLocation()).thenReturn(
                new OfficeGeofence.OfficeLocationResponse(
                        "Office", "Test", 12.0, 77.0, 150, true,
                        "Asia/Kolkata", LocalTime.of(9, 30), LocalTime.of(17, 0),
                        15, "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY"));
        when(attendanceOperationsService.getCalendar(any(), any())).thenReturn(
                new AttendanceOperationsService.CalendarData(
                        List.of(), List.of(), List.of()));
        attendanceService = new AttendanceService(
                attendanceRepository,
                userRepository,
                activityService,
                officeGeofence,
                attendanceOperationsService);

        user = mock(UserAccount.class);
        when(user.getId()).thenReturn(7L);
        when(user.getFullName()).thenReturn("Test Employee");
        when(user.getUsername()).thenReturn("test.employee");
        when(user.getCreatedAt()).thenReturn(
                LocalDate.of(2026, 10, 1).atStartOfDay());
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
    }

    @Test
    void clockInCreatesOneDailyRecord() {
        when(attendanceRepository.findByUser_IdAndWorkDate(7L, LocalDate.now()))
                .thenReturn(Optional.empty());
        when(attendanceRepository.save(any(AttendanceRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AttendanceService.AttendanceResponse response =
                attendanceService.clockIn(7L, officeLocation());

        assertEquals(7L, response.accountId());
        assertEquals("Test Employee", response.fullName());
        assertEquals(LocalDate.now(), response.workDate());
        assertNotNull(response.clockIn());
    }

    @Test
    void clockInRejectsAnExistingDailyRecord() {
        AttendanceRecord existing = new AttendanceRecord(
                user, LocalDate.now(), LocalDateTime.now());
        when(attendanceRepository.findByUser_IdAndWorkDate(7L, LocalDate.now()))
                .thenReturn(Optional.of(existing));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> attendanceService.clockIn(7L, officeLocation()));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void companyAttendanceIsRestrictedToHrAndAdmin() {
        when(user.getRole()).thenReturn("EMPLOYEE");

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> attendanceService.getCompanyAttendance(7L));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void reportMarksPastWeekdaysWithoutClockInAsAbsent() {
        LocalDate monday = LocalDate.of(2026, 10, 19);
        LocalDate tuesday = LocalDate.of(2026, 10, 20);
        AttendanceRecord present = new AttendanceRecord(
                user, monday, monday.atTime(9, 0));
        present.setClockOut(monday.atTime(17, 0));

        when(userRepository.findAllByOrderByFullNameAsc())
                .thenReturn(List.of(user));
        when(attendanceRepository
                .findAllByWorkDateBetweenOrderByWorkDateDescClockInDesc(
                        monday, tuesday))
                .thenReturn(List.of(present));

        AttendanceService.AttendanceReport report =
                attendanceService.getReport(monday, tuesday, null);

        assertEquals(2, report.scheduledDays());
        assertEquals(1, report.presentDays());
        assertEquals(1, report.absentDays());
        assertTrue(report.days().stream()
                .anyMatch(day -> day.workDate().equals(tuesday)
                        && day.status().equals("ABSENT")));
    }

    @Test
    void reportDoesNotCountDaysBeforeAccountCreation() {
        LocalDate monday = LocalDate.of(2026, 10, 19);
        LocalDate tuesday = LocalDate.of(2026, 10, 20);
        when(user.getCreatedAt()).thenReturn(tuesday.atStartOfDay());
        when(userRepository.findAllByOrderByFullNameAsc())
                .thenReturn(List.of(user));
        when(attendanceRepository
                .findAllByWorkDateBetweenOrderByWorkDateDescClockInDesc(
                        monday, tuesday))
                .thenReturn(List.of());

        AttendanceService.AttendanceReport report =
                attendanceService.getReport(monday, tuesday, null);

        assertEquals(1, report.scheduledDays());
        assertEquals(1, report.absentDays());
        assertEquals(tuesday, report.days().get(0).workDate());
    }

    @Test
    void reportClassifiesLateAndEarlyPunchesAsPartialNotAbsent() {
        LocalDate monday = LocalDate.of(2026, 10, 12);
        LocalDate tuesday = monday.plusDays(1);
        LocalDate wednesday = monday.plusDays(2);
        LocalDate thursday = monday.plusDays(3);

        AttendanceRecord lateWithinGrace = completedRecord(
                monday, monday.atTime(9, 40), monday.atTime(17, 0));
        AttendanceRecord lateBeyondGrace = completedRecord(
                tuesday, tuesday.atTime(9, 46), tuesday.atTime(17, 0));
        AttendanceRecord earlyWithinGrace = completedRecord(
                wednesday, wednesday.atTime(9, 30), wednesday.atTime(16, 50));
        AttendanceRecord earlyBeyondGrace = completedRecord(
                thursday, thursday.atTime(9, 30), thursday.atTime(16, 44));

        when(userRepository.findAllByOrderByFullNameAsc())
                .thenReturn(List.of(user));
        when(attendanceRepository
                .findAllByWorkDateBetweenOrderByWorkDateDescClockInDesc(
                        monday, thursday))
                .thenReturn(List.of(
                        lateWithinGrace,
                        lateBeyondGrace,
                        earlyWithinGrace,
                        earlyBeyondGrace));

        AttendanceService.AttendanceReport report =
                attendanceService.getReport(monday, thursday, null);

        assertEquals(2, report.partialDays());
        assertEquals(2, report.presentDays());
        assertEquals(0, report.absentDays());
        assertEquals("PRESENT", statusOn(report, monday));
        assertEquals("PARTIAL", statusOn(report, tuesday));
        assertEquals("PRESENT", statusOn(report, wednesday));
        assertEquals("PARTIAL", statusOn(report, thursday));
    }

    @Test
    void reportDoesNotMarkHolidaysOrApprovedLeaveAbsent() {
        LocalDate monday = LocalDate.of(2026, 10, 19);
        LocalDate tuesday = monday.plusDays(1);
        LocalDate wednesday = monday.plusDays(2);
        LocalDate thursday = monday.plusDays(3);
        AttendanceLeaveRequest approvedLeave = new AttendanceLeaveRequest(
                user, wednesday, wednesday, "Approved leave");

        when(userRepository.findAllByOrderByFullNameAsc())
                .thenReturn(List.of(user));
        when(attendanceRepository
                .findAllByWorkDateBetweenOrderByWorkDateDescClockInDesc(
                        monday, thursday))
                .thenReturn(List.of(completedRecord(
                        monday, monday.atTime(9, 30), monday.atTime(17, 0))));
        when(attendanceOperationsService.getCalendar(monday, thursday)).thenReturn(
                new AttendanceOperationsService.CalendarData(
                        List.of(new AttendanceHoliday(tuesday, "Company holiday")),
                        List.of(approvedLeave),
                        List.of()));

        AttendanceService.AttendanceReport report =
                attendanceService.getReport(monday, thursday, null);

        assertEquals(2, report.scheduledDays());
        assertEquals(1, report.absentDays());
        assertEquals(1, report.holidayDays());
        assertEquals(1, report.leaveDays());
        assertEquals("HOLIDAY", statusOn(report, tuesday));
        assertEquals("LEAVE", statusOn(report, wednesday));
        assertEquals("ABSENT", statusOn(report, thursday));
    }

    private AttendanceRecord completedRecord(
            LocalDate date,
            LocalDateTime clockIn,
            LocalDateTime clockOut) {
        AttendanceRecord record = new AttendanceRecord(user, date, clockIn);
        record.setClockOut(clockOut);
        return record;
    }

    private AttendanceController.AttendanceLocation officeLocation() {
        return new AttendanceController.AttendanceLocation(12.0, 77.0, 10.0);
    }

    private String statusOn(
            AttendanceService.AttendanceReport report,
            LocalDate date) {
        return report.days().stream()
                .filter(day -> day.workDate().equals(date))
                .findFirst()
                .orElseThrow()
                .status();
    }
}
