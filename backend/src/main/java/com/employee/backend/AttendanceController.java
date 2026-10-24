package com.employee.backend;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5174"
})
@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final AttendanceOperationsService attendanceOperationsService;

    public AttendanceController(
            AttendanceService attendanceService,
            AttendanceOperationsService attendanceOperationsService) {
        this.attendanceService = attendanceService;
        this.attendanceOperationsService = attendanceOperationsService;
    }

    @GetMapping("/office-location")
    public OfficeGeofence.OfficeLocationResponse getOfficeLocation() {
        return attendanceService.getOfficeLocation();
    }

    @PutMapping("/office-location")
    public OfficeGeofence.OfficeLocationResponse saveOfficeLocation(
            @RequestBody OfficeGeofence.OfficeLocationRequest location,
            @RequestParam Long requesterId) {
        return attendanceService.saveOfficeLocation(location, requesterId);
    }

    @GetMapping("/holidays")
    public List<AttendanceOperationsService.HolidayResponse> getHolidays(
            @RequestParam LocalDate from,
            @RequestParam LocalDate through) {
        return attendanceOperationsService.getHolidays(from, through);
    }

    @PostMapping("/holidays")
    public AttendanceOperationsService.HolidayResponse addHoliday(
            @RequestBody AttendanceOperationsService.HolidayRequest holiday,
            @RequestParam Long requesterId) {
        return attendanceOperationsService.addHoliday(holiday, requesterId);
    }

    @DeleteMapping("/holidays/{holidayId}")
    public ResponseEntity<Void> deleteHoliday(
            @PathVariable Long holidayId,
            @RequestParam Long requesterId) {
        attendanceOperationsService.deleteHoliday(holidayId, requesterId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/leave-requests")
    public List<AttendanceOperationsService.LeaveResponse> getLeaveRequests(
            @RequestParam Long requesterId,
            @RequestParam(required = false) Long employeeAccountId) {
        return attendanceOperationsService.getLeaveRequests(
                requesterId, employeeAccountId);
    }

    @PostMapping("/{accountId}/leave-requests")
    public AttendanceOperationsService.LeaveResponse requestLeave(
            @PathVariable Long accountId,
            @RequestBody AttendanceOperationsService.LeaveRequest request) {
        return attendanceOperationsService.requestLeave(accountId, request);
    }

    @PutMapping("/leave-requests/{requestId}/decision")
    public AttendanceOperationsService.LeaveResponse decideLeave(
            @PathVariable Long requestId,
            @RequestBody AttendanceOperationsService.DecisionRequest decision,
            @RequestParam Long requesterId) {
        return attendanceOperationsService.decideLeave(requestId, decision, requesterId);
    }

    @GetMapping("/correction-requests")
    public List<AttendanceOperationsService.CorrectionResponse> getCorrectionRequests(
            @RequestParam Long requesterId,
            @RequestParam(required = false) Long employeeAccountId) {
        return attendanceOperationsService.getCorrectionRequests(
                requesterId, employeeAccountId);
    }

    @PostMapping("/{accountId}/correction-requests")
    public AttendanceOperationsService.CorrectionResponse requestCorrection(
            @PathVariable Long accountId,
            @RequestBody AttendanceOperationsService.CorrectionRequest request) {
        return attendanceOperationsService.requestCorrection(accountId, request);
    }

    @PutMapping("/correction-requests/{requestId}/decision")
    public AttendanceOperationsService.CorrectionResponse decideCorrection(
            @PathVariable Long requestId,
            @RequestBody AttendanceOperationsService.DecisionRequest decision,
            @RequestParam Long requesterId) {
        return attendanceOperationsService.decideCorrection(
                requestId, decision, requesterId);
    }

    @GetMapping("/{accountId}/today")
    public ResponseEntity<AttendanceService.AttendanceResponse> getToday(
            @PathVariable Long accountId) {
        Optional<AttendanceService.AttendanceResponse> attendance =
                attendanceService.getToday(accountId);
        return attendance.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{accountId}/history")
    public List<AttendanceService.AttendanceResponse> getUserHistory(
            @PathVariable Long accountId) {
        return attendanceService.getUserHistory(accountId);
    }

    @GetMapping
    public List<AttendanceService.AttendanceResponse> getCompanyAttendance(
            @RequestParam Long requesterId) {
        return attendanceService.getCompanyAttendance(requesterId);
    }

    @GetMapping("/report")
    public AttendanceService.AttendanceReport getReport(
            @RequestParam LocalDate from,
            @RequestParam LocalDate through,
            @RequestParam(required = false) Long employeeAccountId) {
        return attendanceService.getReport(from, through, employeeAccountId);
    }

    @PostMapping("/{accountId}/clock-in")
    public AttendanceService.AttendanceResponse clockIn(
            @PathVariable Long accountId,
            @RequestBody AttendanceLocation location) {
        return attendanceService.clockIn(accountId, location);
    }

    @PostMapping("/{accountId}/clock-out")
    public AttendanceService.AttendanceResponse clockOut(
            @PathVariable Long accountId,
            @RequestBody AttendanceLocation location) {
        return attendanceService.clockOut(accountId, location);
    }

    public record AttendanceLocation(
            Double latitude, Double longitude, Double accuracyMeters) {}
}
