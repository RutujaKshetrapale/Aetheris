package com.aetheris.domain.model;

public class SavePresetRequest {
    private String id;
    private String name;
    private String description;
    private GridModel grid;

    public SavePresetRequest() {}

    public SavePresetRequest(String id, String name, String description, GridModel grid) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.grid = grid;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public GridModel getGrid() { return grid; }
    public void setGrid(GridModel grid) { this.grid = grid; }
}
