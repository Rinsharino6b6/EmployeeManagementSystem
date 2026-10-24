
package com.employee.backend;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.HexFormat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.LocalDateTime;

@Service
public class AuthService {

    private static final Logger logger =
            LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String RESET_REQUEST_MESSAGE =
            "If an account matches that email, the reset request has been processed. Check your inbox and spam folder; contact your administrator if no email arrives.";

    private final UserAccountRepository users;
    private final UsedRegistrationPasscodeRepository usedCodes;
    private final PasswordResetTokenRepository resetTokens;
    private final JavaMailSender mailSender;
    private final BCryptPasswordEncoder encoder =
            new BCryptPasswordEncoder();

    private final List<String> adminCodes;
    private final List<String> hrCodes;
    private final String frontendUrl;
    private final String mailFrom;

    public AuthService(
            UserAccountRepository users,
            UsedRegistrationPasscodeRepository usedCodes,
            PasswordResetTokenRepository resetTokens,
            JavaMailSender mailSender,
            @Value("${app.auth.admin-passcodes}") String adminCodes,
            @Value("${app.auth.hr-passcodes}") String hrCodes,
            @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl,
            @Value("${app.mail.from:${spring.mail.username:}}") String mailFrom) {
        this.users = users;
        this.usedCodes = usedCodes;
        this.resetTokens = resetTokens;
        this.mailSender = mailSender;
        this.adminCodes = parseCodes(adminCodes);
        this.hrCodes = parseCodes(hrCodes);
        this.frontendUrl = frontendUrl;
        this.mailFrom = mailFrom;
    }

    private List<String> parseCodes(String codes) {
        return Arrays.stream(codes.split(","))
                .map(String::trim)
                .map(code -> code.toUpperCase(Locale.ROOT))
                .filter(code -> !code.isBlank())
                .toList();
    }

    private String digest(String code) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                    .digest(code.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private void require(boolean condition, String message) {
        if (!condition) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, message);
        }
    }

    @Transactional
    public UserAccount register(
            String fullName,
            String username,
            String email,
            String password,
            String department,
            String requestedRole,
            String passcode) {

        require(fullName != null && !fullName.isBlank(),
                "Full name is required.");
        require(username != null && !username.isBlank(),
                "Username is required.");
        require(email != null && email.contains("@"),
                "A valid email is required.");
        require(password != null && password.length() >= 8,
                "Password must contain at least 8 characters.");

        fullName = fullName.trim();
        username = username.trim();
        email = email.trim().toLowerCase(Locale.ROOT);
        department = department == null ? "" : department.trim();

        require(fullName.length() <= 100, "Full name is too long.");
        require(username.length() <= 50, "Username is too long.");
        require(email.length() <= 150, "Email is too long.");
        require(password.length() <= 72,
                "Password must be at most 72 characters.");
        require(department.length() <= 100, "Department is too long.");

        require(!users.existsByUsernameIgnoreCase(username),
                "That username is already taken.");
        require(!users.existsByEmailIgnoreCase(email),
                "An account with that email already exists.");

        String role = requestedRole == null
                ? "EMPLOYEE"
                : requestedRole.trim().toUpperCase(Locale.ROOT);

        if ("EMPLOYEE".equals(role)) {
            require(passcode == null || passcode.isBlank(),
                    "Employee registration does not require a passcode.");
        } else if ("ADMIN".equals(role) || "HR_MANAGER".equals(role)) {
            require(passcode != null && !passcode.isBlank(),
                    "A registration passcode is required.");

            List<String> allowedCodes =
                    "ADMIN".equals(role) ? adminCodes : hrCodes;

            String normalizedCode =
                    passcode.trim().toUpperCase(Locale.ROOT);

            require(allowedCodes.contains(normalizedCode),
                    "Invalid registration passcode.");

            String codeDigest = digest(normalizedCode);

            require(!usedCodes.existsByCodeDigest(codeDigest),
                    "This registration passcode has already been used.");

            usedCodes.saveAndFlush(
                    new UsedRegistrationPasscode(codeDigest, role));
        } else {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid role.");
        }

        UserAccount user = new UserAccount();
        user.setFullName(fullName);
        user.setUsername(username);
        user.setEmail(email);
        user.setDepartment(department);
        user.setRole(role);
        user.setPasswordHash(encoder.encode(password));

        return users.save(user);
    }

    @Transactional(readOnly = true)
    public UserAccount login(String username, String password) {
        if (username == null || username.isBlank()
                || password == null || password.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Username and password are required.");
        }

        UserAccount user = users.findByUsernameIgnoreCase(
                username.trim()).orElseThrow(() ->
                new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid username or password."));

        if (!encoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid username or password.");
        }

        return user;
    }

    @Transactional
    public void changePassword(
            Long userId,
            String currentPassword,
            String newPassword) {
        require(currentPassword != null && !currentPassword.isBlank(),
                "Current password is required.");
        require(newPassword != null && newPassword.length() >= 8,
                "New password must contain at least 8 characters.");
        require(newPassword.length() <= 72,
                "New password must be at most 72 characters.");
        require(!currentPassword.equals(newPassword),
                "New password must be different from your current password.");

        UserAccount user = users.findById(userId).orElseThrow(() ->
                new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Your account could not be found."));

        if (!encoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Current password is incorrect.");
        }

        user.setPasswordHash(encoder.encode(newPassword));
        users.save(user);
    }

    @Transactional
    public String requestPasswordReset(String email) {
        if (email == null || email.isBlank() || email.length() > 150) {
            return RESET_REQUEST_MESSAGE;
        }

        users.findByEmailIgnoreCase(email.trim())
                .ifPresent(user -> sendPasswordReset(user));

        return RESET_REQUEST_MESSAGE;
    }

    private void sendPasswordReset(UserAccount user) {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        String rawToken = HexFormat.of().formatHex(bytes);
        String tokenHash = digest(rawToken);

        resetTokens.deleteByUser_Id(user.getId());
        resetTokens.saveAndFlush(new PasswordResetToken(
                tokenHash,
                user,
                LocalDateTime.now().plusMinutes(30)));

        String resetLink = UriComponentsBuilder
                .fromUriString(frontendUrl)
                .fragment("resetToken=" + rawToken)
                .build()
                .toUriString();

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            if (mailFrom != null && !mailFrom.isBlank()) {
                message.setFrom(mailFrom);
            }
            message.setTo(user.getEmail());
            message.setSubject("Reset your BeetaLogic password");
            message.setText(
                    "Hello " + user.getFullName() + ",\n\n"
                    + "We received a request to reset your password. "
                    + "Use the link below within 30 minutes:\n\n"
                    + resetLink + "\n\n"
                    + "If you did not request this, you can ignore this email.");
            mailSender.send(message);
        } catch (MailException | IllegalStateException exception) {
            resetTokens.deleteByUser_Id(user.getId());
            logger.error(
                    "Unable to send password reset email for account id {}.",
                    user.getId(),
                    exception);
        }
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        require(token != null && !token.isBlank(),
                "A valid reset link is required.");
        require(newPassword != null && newPassword.length() >= 8,
                "New password must contain at least 8 characters.");
        require(newPassword.length() <= 72,
                "New password must be at most 72 characters.");

        PasswordResetToken resetToken = resetTokens
                .findByTokenHashForUpdate(digest(token))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "This reset link is invalid or has expired."));

        if (resetToken.isUsed()
                || resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "This reset link is invalid or has expired.");
        }

        UserAccount user = resetToken.getUser();
        user.setPasswordHash(encoder.encode(newPassword));
        user.setSessionTokenHash(null);
        user.setSessionTokenExpiresAt(null);
        users.save(user);
        resetToken.markUsed();
        resetTokens.save(resetToken);
    }
}
