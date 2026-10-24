package com.employee.backend;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceLeaveRequestRepository
        extends JpaRepository<AttendanceLeaveRequest, Long> {

    List<AttendanceLeaveRequest> findAllByUser_IdOrderByCreatedAtDesc(Long userId);

    List<AttendanceLeaveRequest> findAllByOrderByCreatedAtDesc();

    List<AttendanceLeaveRequest> findAllByStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            String status, LocalDate through, LocalDate from);

    boolean existsByUser_IdAndStatusInAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            Long userId, List<String> statuses, LocalDate through, LocalDate from);
}
