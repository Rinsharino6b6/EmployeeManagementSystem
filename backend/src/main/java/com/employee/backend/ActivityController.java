package com.employee.backend;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5174"
})
@RestController
@RequestMapping("/api/activities")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping
    public ActivityService.ActivityFeed getRecentActivities(
            @RequestParam Long requesterId) {
        return activityService.getRecentActivities(requesterId);
    }

    @PostMapping("/read")
    public void markActivitiesRead(@RequestParam Long requesterId) {
        activityService.markActivitiesRead(requesterId);
    }
}
