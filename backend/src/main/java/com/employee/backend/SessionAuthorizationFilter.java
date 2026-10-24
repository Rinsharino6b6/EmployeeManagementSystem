package com.employee.backend;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class SessionAuthorizationFilter extends OncePerRequestFilter {

    private final UserAccountRepository userRepository;

    public SessionAuthorizationFilter(UserAccountRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI()
                .substring(request.getContextPath().length());
        return !path.startsWith("/api/attendance")
                && !path.startsWith("/api/activities");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        Optional<UserAccount> authenticatedUser = authenticate(request);
        if (authenticatedUser.isEmpty()) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "Sign in to access this information.");
            return;
        }

        UserAccount user = authenticatedUser.get();
        String path = request.getRequestURI()
                .substring(request.getContextPath().length());
        if (!isAllowed(request, path, user)) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN,
                    "You do not have permission to access this information.");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private Optional<UserAccount> authenticate(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return Optional.empty();
        }

        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) return Optional.empty();

        return userRepository.findBySessionTokenHash(hashToken(token))
                .filter(user -> user.getSessionTokenExpiresAt() != null)
                .filter(user -> user.getSessionTokenExpiresAt()
                        .isAfter(LocalDateTime.now()));
    }

    private boolean isAllowed(
            HttpServletRequest request,
            String path,
            UserAccount user) {
        if ("/api/attendance/office-location".equals(path)) {
            if ("GET".equalsIgnoreCase(request.getMethod())) {
                return true;
            }
            return "PUT".equalsIgnoreCase(request.getMethod())
                    && requesterIs(request, user)
                    && isHrOrAdmin(user.getRole());
        }

        if ("/api/attendance/holidays".equals(path)) {
            if ("GET".equalsIgnoreCase(request.getMethod())) return true;
            return "POST".equalsIgnoreCase(request.getMethod())
                    && requesterIs(request, user)
                    && isHrOrAdmin(user.getRole());
        }

        if (path.matches("/api/attendance/holidays/\\d+")
                && "DELETE".equalsIgnoreCase(request.getMethod())) {
            return requesterIs(request, user) && isHrOrAdmin(user.getRole());
        }

        if ("/api/attendance/leave-requests".equals(path)
                || "/api/attendance/correction-requests".equals(path)) {
            if (!"GET".equalsIgnoreCase(request.getMethod())
                    || !requesterIs(request, user)) return false;
            String employeeId = request.getParameter("employeeAccountId");
            return isHrOrAdmin(user.getRole())
                    || employeeId == null
                    || employeeId.equals(user.getId().toString());
        }

        if (path.matches("/api/attendance/(leave-requests|correction-requests)/\\d+/decision")
                && "PUT".equalsIgnoreCase(request.getMethod())) {
            return requesterIs(request, user) && isHrOrAdmin(user.getRole());
        }

        String[] requestSegments = path.split("/");
        if (requestSegments.length == 5
                && "api".equals(requestSegments[1])
                && "attendance".equals(requestSegments[2])
                && ("leave-requests".equals(requestSegments[4])
                || "correction-requests".equals(requestSegments[4]))
                && "POST".equalsIgnoreCase(request.getMethod())) {
            try {
                return Long.valueOf(requestSegments[3]).equals(user.getId());
            } catch (NumberFormatException exception) {
                return false;
            }
        }

        if ("/api/attendance/report".equals(path)
                && "GET".equalsIgnoreCase(request.getMethod())) {
            String employeeId = request.getParameter("employeeAccountId");
            return isHrOrAdmin(user.getRole())
                    || (employeeId != null
                    && employeeId.equals(user.getId().toString()));
        }

        if ("/api/attendance".equals(path)
                && "GET".equalsIgnoreCase(request.getMethod())) {
            String requesterId = request.getParameter("requesterId");
            return isHrOrAdmin(user.getRole())
                    && requesterId != null
                    && requesterId.equals(user.getId().toString());
        }

        if ("/api/activities".equals(path)
                && "GET".equalsIgnoreCase(request.getMethod())) {
            String requesterId = request.getParameter("requesterId");
            return requesterId != null
                    && requesterId.equals(user.getId().toString());
        }

        if ("/api/activities/read".equals(path)
                && "POST".equalsIgnoreCase(request.getMethod())) {
            String requesterId = request.getParameter("requesterId");
            return requesterId != null
                    && requesterId.equals(user.getId().toString());
        }

        String[] segments = path.split("/");
        if (segments.length != 5
                || !"api".equals(segments[1])
                || !"attendance".equals(segments[2])) {
            return false;
        }

        Long targetId;
        try {
            targetId = Long.valueOf(segments[3]);
        } catch (NumberFormatException exception) {
            return false;
        }

        String action = segments[4];
        if ("GET".equalsIgnoreCase(request.getMethod())
                && ("today".equals(action) || "history".equals(action))) {
            return targetId.equals(user.getId()) || isHrOrAdmin(user.getRole());
        }

        if ("POST".equalsIgnoreCase(request.getMethod())
                && ("clock-in".equals(action) || "clock-out".equals(action))) {
            return targetId.equals(user.getId());
        }

        return false;
    }

    private boolean requesterIs(HttpServletRequest request, UserAccount user) {
        String requesterId = request.getParameter("requesterId");
        return requesterId != null && requesterId.equals(user.getId().toString());
    }

    private boolean isHrOrAdmin(String role) {
        return "ADMIN".equalsIgnoreCase(role)
                || "HR_MANAGER".equalsIgnoreCase(role);
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

    private void writeError(
            HttpServletResponse response,
            int status,
            String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
