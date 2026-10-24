package com.employee.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class AttendanceOperationsServiceTest {

    private AttendanceHolidayRepository holidayRepository;
    private AttendanceLeaveRequestRepository leaveRepository;
    private AttendanceCorrectionRequestRepository correctionRepository;
    private AttendanceRecordRepository attendanceRepository;
    private UserAccountRepository userRepository;
    private OfficeGeofence officeGeofence;
    private ActivityService activityService;
    private AttendanceOperationsService operationsService;
    private UserAccount employee;
    private UserAccount reviewer;

    @BeforeEach
    void setUp() {
        holidayRepository = mock(AttendanceHolidayRepository.class);
        leaveRepository = mock(AttendanceLeaveRequestRepository.class);
        correctionRepository = mock(AttendanceCorrectionRequestRepository.class);
        attendanceRepository = mock(AttendanceRecordRepository.class);
        userRepository = mock(UserAccountRepository.class);
        officeGeofence = mock(OfficeGeofence.class);
        activityService = mock(ActivityService.class);
        operationsService = new AttendanceOperationsService(
                holidayRepository,
                leaveRepository,
                correctionRepository,
                attendanceRepository,
                userRepository,
                officeGeofence,
                activityService);

        employee = mock(UserAccount.class);
        when(employee.getId()).thenReturn(7L);
        when(employee.getFullName()).thenReturn("Employee");
        reviewer = mock(UserAccount.class);
        when(reviewer.getId()).thenReturn(8L);
        when(reviewer.getRole()).thenReturn("HR_MANAGER");
        when(reviewer.getFullName()).thenReturn("Reviewer");
        when(userRepository.findById(8L)).thenReturn(Optional.of(reviewer));
        when(officeGeofence.getOfficeLocation()).thenReturn(
                new OfficeGeofence.OfficeLocationResponse(
                        "Office", "Address", 12.0, 77.0, 150, true,
                        "Asia/Kolkata", LocalTime.of(9, 30), LocalTime.of(17, 0),
                        15, "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY"));
    }

    @Test
    void correctionApprovalUpdatesTimesAndRecordsAnAuditEvent() {
        LocalDate workDate = LocalDate.now().minusDays(1);
        AttendanceCorrectionRequest correction = new AttendanceCorrectionRequest(
                employee,
                workDate,
                workDate.atTime(9, 20),
                null,
                "Forgot to clock in");
        AttendanceRecord existing = new AttendanceRecord(
                employee, workDate, workDate.atTime(9, 40));
        existing.setClockOut(workDate.atTime(17, 0));
        when(correctionRepository.findById(9L)).thenReturn(Optional.of(correction));
        when(attendanceRepository.findByUser_IdAndWorkDate(7L, workDate))
                .thenReturn(Optional.of(existing));
        when(attendanceRepository.save(any(AttendanceRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AttendanceOperationsService.CorrectionResponse response =
                operationsService.decideCorrection(
                        9L,
                        new AttendanceOperationsService.DecisionRequest("APPROVED"),
                        8L);

        assertEquals("APPROVED", response.status());
        assertEquals(workDate.atTime(9, 20), existing.getClockIn());
        assertEquals(workDate.atTime(17, 0), existing.getClockOut());
        verify(activityService).record(
                reviewer, "ATTENDANCE_CORRECTION_APPROVED",
                "approved correction #9 for account 7 on " + workDate
                        + "; previous clock-in " + workDate.atTime(9, 40)
                        + ", clock-out " + workDate.atTime(17, 0)
                        + "; requested clock-in " + workDate.atTime(9, 20)
                        + ", clock-out null");
    }

    @Test
    void employeeCannotApproveTheirOwnLeaveRequest() {
        when(userRepository.findById(7L)).thenReturn(Optional.of(employee));
        AttendanceLeaveRequest leave = new AttendanceLeaveRequest(
                employee,
                LocalDate.now().plusDays(1),
                LocalDate.now().plusDays(1),
                "Personal leave");
        when(leaveRepository.findById(11L)).thenReturn(Optional.of(leave));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> operationsService.decideLeave(
                        11L,
                        new AttendanceOperationsService.DecisionRequest("APPROVED"),
                        7L));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void adminLeaveIsAutomaticallyApproved() {
        when(employee.getRole()).thenReturn("ADMIN");
        when(userRepository.findById(7L)).thenReturn(Optional.of(employee));
        when(leaveRepository.save(any(AttendanceLeaveRequest.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AttendanceOperationsService.LeaveResponse response =
                operationsService.requestLeave(
                        7L,
                        new AttendanceOperationsService.LeaveRequest(
                                LocalDate.now().plusDays(1),
                                LocalDate.now().plusDays(1),
                                "Personal leave"));

        assertEquals("APPROVED", response.status());
        assertEquals("Employee", response.reviewerName());
    }

    @Test
    void adminCorrectionIsAutomaticallyApplied() {
        when(employee.getRole()).thenReturn("ADMIN");
        when(userRepository.findById(7L)).thenReturn(Optional.of(employee));
        when(correctionRepository.save(any(AttendanceCorrectionRequest.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        LocalDate workDate = LocalDate.now().minusDays(1);
        when(attendanceRepository.findByUser_IdAndWorkDate(7L, workDate))
                .thenReturn(Optional.empty());
        when(attendanceRepository.save(any(AttendanceRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AttendanceOperationsService.CorrectionResponse response =
                operationsService.requestCorrection(
                        7L,
                        new AttendanceOperationsService.CorrectionRequest(
                                workDate,
                                workDate.atTime(9, 0),
                                workDate.atTime(17, 0),
                                "Forgot to clock in and out"));

        assertEquals("APPROVED", response.status());
        assertEquals("Employee", response.reviewerName());
        verify(attendanceRepository).save(any(AttendanceRecord.class));
    }
}
