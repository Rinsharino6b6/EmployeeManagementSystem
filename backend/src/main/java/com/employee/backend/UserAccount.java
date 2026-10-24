
package com.employee.backend;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(length = 100)
    private String department;

    @Column(nullable = false, length = 20)
    private String role = "EMPLOYEE";

    @Column(name = "employee_record_id", unique = true, length = 50)
    private String employeeId;

    @Column(name = "session_token_hash", unique = true, length = 64)
    private String sessionTokenHash;

    @Column(name = "session_token_expires_at")
    private LocalDateTime sessionTokenExpiresAt;

    @Column(name = "activity_read_at")
    private LocalDateTime activityReadAt;

    @Lob
    private String profilePicture;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public UserAccount() {}

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public String getDepartment() { return department; }
    public String getRole() { return role; }
    public String getEmployeeId() { return employeeId; }
    public String getSessionTokenHash() { return sessionTokenHash; }
    public LocalDateTime getSessionTokenExpiresAt() { return sessionTokenExpiresAt; }
    public LocalDateTime getActivityReadAt() { return activityReadAt; }
    public String getProfilePicture() { return profilePicture; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setUsername(String username) { this.username = username; }
    public void setEmail(String email) { this.email = email; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public void setDepartment(String department) { this.department = department; }
    public void setRole(String role) { this.role = role; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public void setSessionTokenHash(String sessionTokenHash) {
        this.sessionTokenHash = sessionTokenHash;
    }
    public void setSessionTokenExpiresAt(LocalDateTime sessionTokenExpiresAt) {
        this.sessionTokenExpiresAt = sessionTokenExpiresAt;
    }
    public void setActivityReadAt(LocalDateTime activityReadAt) {
        this.activityReadAt = activityReadAt;
    }
    public void setProfilePicture(String profilePicture) {
        this.profilePicture = profilePicture;
    }
}
