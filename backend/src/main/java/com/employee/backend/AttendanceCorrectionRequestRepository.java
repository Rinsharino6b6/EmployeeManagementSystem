package com.employee.backend;

import java.util.List;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceCorrectionRequestRepository
        extends JpaRepository<AttendanceCorrectionRequest, Long> {

    List<AttendanceCorrectionRequest> findAllByUser_IdOrderByCreatedAtDesc(Long userId);

    List<AttendanceCorrectionRequest> findAllByOrderByCreatedAtDesc();

    List<AttendanceCorrectionRequest> findAllByStatusAndWorkDateBetween(
            String status, LocalDate from, LocalDate through);
}
