package com.storydream.backend.domain.report.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class PartTypeConverter implements AttributeConverter<PartType, String> {

    @Override
    public String convertToDatabaseColumn(PartType attribute) {
        return attribute == null ? null : attribute.getLabel();
    }

    @Override
    public PartType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : PartType.from(dbData);
    }
}