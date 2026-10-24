package com.employee.backend;

import java.time.LocalDateTime;
import java.util.List;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ActivityService {

    private final ActivityLogRepository activityRepository;
    private final UserAccountRepository userRepository;

    public ActivityService(
            ActivityLogRepository activityRepository,
            UserAccountRepository userRepository) {
        this.activityRepository = activityRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void record(UserAccount actor, String eventType, String message) {
        activityRepository.save(new ActivityLog(actor, eventType, message));
    }

    @Transactional(readOnly = true)
    public UserAccount requireActor(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Sign in to record this activity.");
        }
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Sign in to record this activity.");
        }
        String tokenHash;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            tokenHash = Base64.getEncoder().withoutPadding()
                    .encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
        return userRepository.findBySessionTokenHash(tokenHash)
                .filter(user -> user.getSessionTokenExpiresAt() != null)
                .filter(user -> user.getSessionTokenExpiresAt()
                        .isAfter(LocalDateTime.now()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Your session has expired. Sign in again."));
    }

    @Transactional(readOnly = true)
    public ActivityFeed getRecentActivities(Long requesterId) {
        UserAccount requester = getUser(requesterId);
        boolean companyFeed = isHrOrAdmin(requester.getRole());
        LocalDateTime readAt = requester.getActivityReadAt();
        List<ActivityItem> items = (companyFeed
                ? activityRepository.findTop50ByOrderByCreatedAtDesc()
                : activityRepository.findTop50ByActor_IdOrderByCreatedAtDesc(
                        requesterId))
                .stream()
                .map(activity -> ActivityItem.from(activity, companyFeed, readAt))
                .toList();

        long unreadCount = readAt == null
                ? (companyFeed
                    ? activityRepository.count()
                    : activityRepository.countByActor_Id(requesterId))
                : (companyFeed
                    ? activityRepository.countByCreatedAtAfter(readAt)
                    : activityRepository.countByActor_IdAndCreatedAtAfter(
                            requesterId, readAt));
        return new ActivityFeed(items, unreadCount);
    }

    @Transactional
    public void markActivitiesRead(Long requesterId) {
        UserAccount requester = getUser(requesterId);
        requester.setActivityReadAt(LocalDateTime.now());
        userRepository.save(requester);
    }

    private UserAccount getUser(Long accountId) {
        if (accountId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "An account ID is required.");
        }
        return userRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User account was not found."));
    }

    private boolean isHrOrAdmin(String role) {
        return "ADMIN".equalsIgnoreCase(role)
                || "HR_MANAGER".equalsIgnoreCase(role);
    }

    public record ActivityItem(
            Long id,
            String eventType,
            String message,
            String actorName,
            LocalDateTime createdAt,
            boolean read) {

        static ActivityItem from(
                ActivityLog activity,
                boolean companyFeed,
                LocalDateTime readAt) {
            return new ActivityItem(
                    activity.getId(),
                    activity.getEventType(),
                    activity.getMessage(),
                    companyFeed ? activity.getActor().getFullName() : null,
                    activity.getCreatedAt(),
                    readAt != null && !activity.getCreatedAt().isAfter(readAt));
        }
    }

    public record ActivityFeed(List<ActivityItem> activities, long unreadCount) {}
}
