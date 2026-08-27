package com.storydream.backend.domain.reading.dto;


import java.util.List;

public record PageResponse(
        Integer pageId,
        Integer pageNum,
        String imageUrl,
        String audioUrl,
        List<SentenceResponse> sentences
) {
}
