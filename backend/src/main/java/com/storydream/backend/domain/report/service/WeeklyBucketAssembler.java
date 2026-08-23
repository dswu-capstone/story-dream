package com.storydream.backend.domain.report.service;

import com.storydream.backend.domain.report.dto.ReportOverviewResponse.WeeklyScorePoint;
import com.storydream.backend.domain.report.repository.projection.WeeklyScoreStat;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class WeeklyBucketAssembler {

    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("M/d");

    public List<WeeklyScorePoint> assemble(LocalDate from, LocalDate to, List<WeeklyScoreStat> stats) {

        Map<Integer, WeeklyScoreStat> byBucket = stats.stream()
                .collect(Collectors.toMap(WeeklyScoreStat::getBucketIndex, Function.identity()));

        List<WeeklyScorePoint> points = new ArrayList<>();
        int index = 0;
        LocalDate cursor = from;

        while (!cursor.isAfter(to)) {
            LocalDate weekEnd = cursor.plusDays(6);
            if (weekEnd.isAfter(to)) weekEnd = to;

            WeeklyScoreStat stat = byBucket.get(index);

            points.add(new WeeklyScorePoint(
                    cursor.format(LABEL) + " ~ " + weekEnd.format(LABEL),
                    cursor,
                    weekEnd,
                    stat == null ? 0 : stat.getReadingCount().intValue(),
                    stat == null || stat.getAvgScore() == null ? null : stat.getAvgScore().doubleValue()
            ));

            cursor = cursor.plusDays(7);
            index++;
        }
        return points;
    }
}
