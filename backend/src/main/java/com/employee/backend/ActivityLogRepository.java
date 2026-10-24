package com.employee.backend;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    List<ActivityLog> findTop50ByOrderByCreatedAtDesc();

    List<ActivityLog> findTop50ByActor_IdOrderByCreatedAtDesc(Long actorId);

    long countByCreatedAtAfter(LocalDateTime createdAt);

    long countByActor_Id(Long actorId);

    long countByActor_IdAndCreatedAtAfter(Long actorId, LocalDateTime createdAt);
}
