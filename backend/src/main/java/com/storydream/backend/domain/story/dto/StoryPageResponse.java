package com.storydream.backend.domain.story.dto;
import java.util.List;

public record StoryPageResponse(
        Integer pageId,
        Integer pageNum,
        String imageUrl,
        List<StorySentenceResponse> sentences
) {
}
