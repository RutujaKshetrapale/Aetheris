package com.aetheris.adapter.persistence.mongo;

import com.aetheris.domain.model.GridModel;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "presets")
public class PresetDocument {

    @Id
    private String mongoId;

    @Field("id")
    @Indexed(unique = true)
    private String domainId;

    private String name;
    private String description;
    private GridModel grid;
    private String createdAt;
    private String updatedAt;

    public PresetDocument() {}

    public String getMongoId() { return mongoId; }
    public void setMongoId(String mongoId) { this.mongoId = mongoId; }

    public String getDomainId() { return domainId; }
    public void setDomainId(String domainId) { this.domainId = domainId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public GridModel getGrid() { return grid; }
    public void setGrid(GridModel grid) { this.grid = grid; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
