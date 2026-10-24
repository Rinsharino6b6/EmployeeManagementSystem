
package com.employee.backend;

import org.springframework.http.HttpStatus;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5174"
})
public class ProfileController {

    private final UserAccountRepository users;
    private final EmployeeRepository employees;
    private final AuthService authService;
    private final ActivityService activityService;

    public ProfileController(
            UserAccountRepository users,
            EmployeeRepository employees,
            AuthService authService,
            ActivityService activityService) {
        this.users = users;
        this.employees = employees;
        this.authService = authService;
        this.activityService = activityService;
    }

    public record ProfileRequest(
            String name,
            String email,
            String department,
            String profilePicture) {}

    public record ProfileResponse(
            Long id,
            String fullName,
            String username,
            String email,
            String department,
            String role,
            String employeeId,
            String profilePicture,
            String createdAt) {}

    public record EmployeeLinkRequest(String employeeId) {}

    public record AccountSummary(
            Long id,
            String fullName,
            String email,
            String role,
            String employeeId) {}

    public record PasswordRequest(
            String currentPassword,
            String newPassword) {}

    public record MessageResponse(String message) {}

    @GetMapping
    @Transactional(readOnly = true)
    public List<AccountSummary> listAccounts(
            @RequestHeader(
                    value = "Authorization",
                    required = false) String authorization) {
        UserAccount actor = activityService.requireActor(authorization);
        if (!isHrOrAdmin(actor.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only HR and Admin users can view account links.");
        }
        return users.findAllByOrderByFullNameAsc().stream()
                .map(user -> new AccountSummary(
                        user.getId(),
                        user.getFullName(),
                        user.getEmail(),
                        user.getRole(),
                        user.getEmployeeId()))
                .toList();
    }

    @PutMapping("/{id}/profile")
    @Transactional
    public ProfileResponse updateProfile(
            @PathVariable Long id,
            @RequestBody ProfileRequest request,
            @RequestHeader(
                    value = "Authorization",
                    required = false) String authorization) {
        UserAccount actor = activityService.requireActor(authorization);
        if (!id.equals(actor.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You can only update your own profile.");
        }
        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Profile details are required.");
        }

        UserAccount user = users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Your account could not be found."));

        String name = request.name() == null
                ? user.getFullName() : request.name().trim();

        String email = request.email() == null
                ? user.getEmail() : request.email().trim().toLowerCase();

        String department = request.department() == null
                ? user.getDepartment() : request.department().trim();
        if (department == null) {
            department = "";
        }

        if (name.isBlank() || email.isBlank() || !email.contains("@")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Enter a valid name and email.");
        }

        if (name.length() > 100 || email.length() > 150
                || department.length() > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "One or more fields exceed the allowed length.");
        }

        boolean duplicateEmail = users.existsByEmailIgnoreCase(email)
                && !email.equalsIgnoreCase(user.getEmail());

        if (duplicateEmail) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "That email address is already used by another account.");
        }

        user.setFullName(name);
        user.setEmail(email);
        user.setDepartment(department);

        if (request.profilePicture() != null) {
            user.setProfilePicture(request.profilePicture());
        }

        UserAccount saved = users.save(user);
        activityService.record(
                saved, "PROFILE_UPDATED", "Updated profile details");

        return new ProfileResponse(
                saved.getId(),
                saved.getFullName(),
                saved.getUsername(),
                saved.getEmail(),
                saved.getDepartment(),
                saved.getRole(),
                saved.getEmployeeId(),
                saved.getProfilePicture(),
                saved.getCreatedAt() == null
                        ? null : saved.getCreatedAt().toString());
    }

    @PutMapping("/{id}/employee-link")
    @Transactional
    public ProfileResponse linkEmployeeRecord(
            @PathVariable Long id,
            @RequestBody EmployeeLinkRequest request,
            @RequestHeader(
                    value = "Authorization",
                    required = false) String authorization) {
        UserAccount actor = activityService.requireActor(authorization);
        if (!isHrOrAdmin(actor.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only HR and Admin users can link employee records.");
        }

        UserAccount account = users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User account was not found."));
        String employeeId = request == null || request.employeeId() == null
                || request.employeeId().isBlank()
                ? null : request.employeeId().trim();

        if (employeeId != null) {
            if (!employees.existsById(employeeId)) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Employee record was not found.");
            }
            if (users.existsByEmployeeId(employeeId)
                    && !employeeId.equals(account.getEmployeeId())) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "That employee record is already linked to another account.");
            }
        }

        String previousEmployeeId = account.getEmployeeId();
        account.setEmployeeId(employeeId);
        UserAccount saved = users.save(account);
        activityService.record(
                actor,
                "EMPLOYEE_ACCOUNT_LINKED",
                employeeId == null
                        ? "Unlinked employee record " + previousEmployeeId
                                + " from account " + id
                        : "Linked employee record " + employeeId
                                + " to account " + id);
        return profileResponse(saved);
    }

    @PutMapping("/{id}/password")
    @Transactional
    public MessageResponse updatePassword(
            @PathVariable Long id,
            @RequestBody PasswordRequest request,
            @RequestHeader(
                    value = "Authorization",
                    required = false) String authorization) {
        UserAccount actor = activityService.requireActor(authorization);
        if (!id.equals(actor.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You can only change your own password.");
        }
        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password details are required.");
        }

        authService.changePassword(
                id,
                request.currentPassword(),
                request.newPassword());
        activityService.record(
                actor, "PASSWORD_CHANGED", "Changed account password");
        return new MessageResponse("Password updated successfully.");
    }

    private ProfileResponse profileResponse(UserAccount user) {
        return new ProfileResponse(
                user.getId(),
                user.getFullName(),
                user.getUsername(),
                user.getEmail(),
                user.getDepartment(),
                user.getRole(),
                user.getEmployeeId(),
                user.getProfilePicture(),
                user.getCreatedAt() == null
                        ? null : user.getCreatedAt().toString());
    }

    private boolean isHrOrAdmin(String role) {
        return "ADMIN".equalsIgnoreCase(role)
                || "HR_MANAGER".equalsIgnoreCase(role);
    }
}
