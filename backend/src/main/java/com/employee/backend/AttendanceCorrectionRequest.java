package com.employee.backend;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendance_correction_requests")
public class AttendanceCorrectionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "requested_clock_in")
    private LocalDateTime requestedClockIn;

    @Column(name = "requested_clock_out")
    private LocalDateTime requestedClockOut;

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_user_id")
    private UserAccount reviewer;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    protected AttendanceCorrectionRequest() {}

    public AttendanceCorrectionRequest(
            UserAccount user,
            LocalDate workDate,
            LocalDateTime requestedClockIn,
            LocalDateTime requestedClockOut,
            String reason) {
        this.user = user;
        this.workDate = workDate;
        this.requestedClockIn = requestedClockIn;
        this.requestedClockOut = requestedClockOut;
        this.reason = reason;
    }

    public void decide(String status, UserAccount reviewer, LocalDateTime reviewedAt) {
        this.status = status;
        this.reviewer = reviewer;
        this.reviewedAt = reviewedAt;
    }

    public Long getId() { return id; }
    public UserAccount getUser() { return user; }
    public LocalDate getWorkDate() { return workDate; }
    public LocalDateTime getRequestedClockIn() { return requestedClockIn; }
    public LocalDateTime getRequestedClockOut() { return requestedClockOut; }
    public String getReason() { return reason; }
    public String getStatus() { return status; }
    public UserAccount getReviewer() { return reviewer; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
