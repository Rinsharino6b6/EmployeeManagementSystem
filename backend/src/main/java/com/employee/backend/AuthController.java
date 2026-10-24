
package com.employee.backend;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5174"
})
public class AuthController {

    private final AuthService authService;
    private final UserAccountRepository userRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthController(
            AuthService authService,
            UserAccountRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    public record RegisterRequest(
            String fullName,
            String username,
            String email,
            String password,
            String department,
            String role,
            String passcode) {}

    public record LoginRequest(
            String username,
            String password) {}

    public record PasswordResetRequest(String email) {}

    public record PasswordResetConfirmRequest(
            String token,
            String newPassword) {}

    public record MessageResponse(String message) {}

    public record UserResponse(
            Long id,
            String fullName,
            String username,
            String email,
            String department,
            String role,
            String employeeId,
            String profilePicture,
            String createdAt) {

        static UserResponse from(UserAccount user) {
            return new UserResponse(
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
    }

    public record AuthResponse(
            boolean ok,
            String message,
            UserResponse user,
            String accessToken) {}

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @RequestBody RegisterRequest request) {

        if (request == null) {
            throw new org.springframework.web.server
                    .ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Registration details are required.");
        }

        UserAccount user = authService.register(
                request.fullName(),
                request.username(),
                request.email(),
                request.password(),
                request.department(),
                request.role(),
                request.passcode());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AuthResponse(
                        true,
                        "Account created successfully.",
                        UserResponse.from(user),
                        null));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @RequestBody LoginRequest request) {

        if (request == null) {
            throw new org.springframework.web.server
                    .ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Login details are required.");
        }

        UserAccount user = authService.login(
                request.username(), request.password());
        byte[] tokenBytes = new byte[32];
        secureRandom.nextBytes(tokenBytes);
        String accessToken = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(tokenBytes);
        user.setSessionTokenHash(hashToken(accessToken));
        user.setSessionTokenExpiresAt(LocalDateTime.now().plusHours(12));
        userRepository.save(user);

        return ResponseEntity.ok(new AuthResponse(
                true,
                "Login successful.",
                UserResponse.from(user),
                accessToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestHeader(
                    value = "Authorization",
                    required = false) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring("Bearer ".length()).trim();
            if (!token.isEmpty()) {
                userRepository.findBySessionTokenHash(hashToken(token))
                        .ifPresent(user -> {
                            user.setSessionTokenHash(null);
                            user.setSessionTokenExpiresAt(null);
                            userRepository.save(user);
                        });
            }
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset/request")
    public MessageResponse requestPasswordReset(
            @RequestBody PasswordResetRequest request) {
        String email = request == null ? null : request.email();
        return new MessageResponse(
                authService.requestPasswordReset(email));
    }

    @PostMapping("/password-reset/confirm")
    public MessageResponse confirmPasswordReset(
            @RequestBody PasswordResetConfirmRequest request) {
        if (request == null) {
            throw new org.springframework.web.server
                    .ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password reset details are required.");
        }

        authService.resetPassword(request.token(), request.newPassword());
        return new MessageResponse("Your password has been reset. You can now sign in.");
    }

    private String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }
}
