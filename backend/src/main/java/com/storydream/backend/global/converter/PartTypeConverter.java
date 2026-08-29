package com.storydream.backend.global.converter;

import com.storydream.backend.global.common.PartType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class PartTypeConverter implements AttributeConverter<PartType, String> {

    @Override
    public String convertToDatabaseColumn(PartType attribute) {
        return attribute == null ? null : attribute.getDbValue();
    }

    @Override
    public PartType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : PartType.fromDbValue(dbData);
    }
}
