package com.aetheris.application;

import com.aetheris.domain.exception.DomainValidationException;
import com.aetheris.domain.exception.SchemaValidationException;
import com.aetheris.domain.model.*;
import com.aetheris.domain.validation.GridValidator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Component
public class PresetBundleCodec {

    public static final String BUNDLE_FORMAT = "aetheris-preset-bundle";
    public static final String BUNDLE_FORMAT_VERSION = "1.0.0";

    private static final Pattern SHA256_HEX = Pattern.compile("^[a-f0-9]{64}$");
    private static final Set<String> BUNDLE_KEYS = Set.of("format", "formatVersion", "exportedAt", "contentHash", "presets");
    private static final Set<String> PRESET_KEYS = Set.of("id", "name", "description", "grid", "createdAt");
    private static final Set<String> GRID_KEYS = Set.of("rows", "cols", "startNode", "targetNode", "cells");
    private static final Set<String> CELL_KEYS = Set.of("id", "row", "col", "cellType", "weight");

    private final ObjectMapper strictMapper;

    public PresetBundleCodec() {
        this.strictMapper = new ObjectMapper();
        this.strictMapper.configure(DeserializationFeature.FAIL_ON_TRAILING_TOKENS, true);
        this.strictMapper.configure(DeserializationFeature.ACCEPT_FLOAT_AS_INT, false);
        this.strictMapper.configure(JsonParser.Feature.ALLOW_COMMENTS, false);
    }

    public byte[] encodePretty(List<GridPreset> presets) {
        List<Map<String, Object>> presetMaps = new ArrayList<>(presets.size());
        for (GridPreset preset : presets) {
            presetMaps.add(toCanonicalPresetMap(preset));
        }

        Map<String, Object> hashCore = new TreeMap<>();
        hashCore.put("format", BUNDLE_FORMAT);
        hashCore.put("formatVersion", BUNDLE_FORMAT_VERSION);
        hashCore.put("presets", presetMaps);

        String compactCore = serializeJson(hashCore, false, 0);
        String contentHash = sha256Hex(compactCore);

        Map<String, Object> bundle = new TreeMap<>();
        bundle.put("contentHash", contentHash);
        bundle.put("exportedAt", Instant.now().toString());
        bundle.put("format", BUNDLE_FORMAT);
        bundle.put("formatVersion", BUNDLE_FORMAT_VERSION);
        bundle.put("presets", presetMaps);

        String pretty = serializeJson(bundle, true, 0);
        return pretty.getBytes(StandardCharsets.UTF_8);
    }

    public List<GridPreset> decodeAndValidate(byte[] rawBytes) {
        if (rawBytes == null || rawBytes.length == 0) {
            throw new SchemaValidationException("Import bundle body cannot be empty.");
        }
        if (rawBytes.length >= 3
                && (rawBytes[0] & 0xFF) == 0xEF
                && (rawBytes[1] & 0xFF) == 0xBB
                && (rawBytes[2] & 0xFF) == 0xBF) {
            throw new SchemaValidationException("Import bundle must use UTF-8 without BOM.");
        }

        JsonNode root;
        try {
            root = strictMapper.readTree(rawBytes);
        } catch (Exception ex) {
            throw new SchemaValidationException("Import bundle contains malformed JSON.");
        }

        if (root == null || !root.isObject()) {
            throw new SchemaValidationException("Import bundle must be a JSON object.");
        }

        Iterator<String> rootKeys = root.fieldNames();
        while (rootKeys.hasNext()) {
            String key = rootKeys.next();
            if (!BUNDLE_KEYS.contains(key)) {
                throw new SchemaValidationException("Unexpected property in preset bundle: " + key);
            }
        }

        JsonNode formatNode = root.get("format");
        if (formatNode == null || !formatNode.isTextual()) {
            throw new SchemaValidationException("Preset bundle 'format' field is required and must be a string.");
        }
        if (!BUNDLE_FORMAT.equals(formatNode.asText())) {
            throw new DomainValidationException("Incompatible preset bundle format: " + formatNode.asText());
        }

        JsonNode versionNode = root.get("formatVersion");
        if (versionNode == null || !versionNode.isTextual()) {
            throw new SchemaValidationException("Preset bundle 'formatVersion' field is required and must be a string.");
        }
        if (!BUNDLE_FORMAT_VERSION.equals(versionNode.asText())) {
            throw new DomainValidationException("Incompatible preset bundle formatVersion: " + versionNode.asText());
        }

        JsonNode exportedAtNode = root.get("exportedAt");
        if (exportedAtNode != null && !exportedAtNode.isTextual()) {
            throw new SchemaValidationException("Preset bundle 'exportedAt' must be a string.");
        }

        JsonNode presetsNode = root.get("presets");
        if (presetsNode == null || !presetsNode.isArray()) {
            throw new SchemaValidationException("Preset bundle 'presets' field is required and must be an array.");
        }

        List<GridPreset> imported = new ArrayList<>();
        List<Map<String, Object>> canonicalForHash = new ArrayList<>();

        for (int i = 0; i < presetsNode.size(); i++) {
            JsonNode pNode = presetsNode.get(i);
            GridPreset preset = parsePresetNode(pNode, i);
            GridValidator.validateGrid(preset.getGrid());
            imported.add(preset);
            canonicalForHash.add(toCanonicalPresetMap(preset));
        }

        JsonNode hashNode = root.get("contentHash");
        if (hashNode != null) {
            if (!hashNode.isTextual()) {
                throw new SchemaValidationException("Preset bundle 'contentHash' must be a string.");
            }
            String providedHash = hashNode.asText();
            if (!SHA256_HEX.matcher(providedHash).matches()) {
                throw new SchemaValidationException("Preset bundle 'contentHash' must be a 64-character lowercase SHA-256 hex digest.");
            }
            Map<String, Object> hashCore = new TreeMap<>();
            hashCore.put("format", BUNDLE_FORMAT);
            hashCore.put("formatVersion", BUNDLE_FORMAT_VERSION);
            hashCore.put("presets", canonicalForHash);
            String expectedHash = sha256Hex(serializeJson(hashCore, false, 0));
            if (!expectedHash.equals(providedHash)) {
                throw new DomainValidationException("Preset bundle contentHash mismatch; bundle integrity verification failed.");
            }
        }

        return imported;
    }

    private GridPreset parsePresetNode(JsonNode pNode, int index) {
        if (pNode == null || !pNode.isObject()) {
            throw new SchemaValidationException("Preset entry at index " + index + " must be a JSON object.");
        }
        Iterator<String> keys = pNode.fieldNames();
        while (keys.hasNext()) {
            String key = keys.next();
            if (!PRESET_KEYS.contains(key)) {
                throw new SchemaValidationException("Unexpected property in preset entry: " + key);
            }
        }

        String id = requireNonBlankString(pNode, "id", "presets[" + index + "].id");
        GridValidator.validateResourceId(id, "Preset");
        String name = requireNonBlankString(pNode, "name", "presets[" + index + "].name");

        String description = null;
        if (pNode.has("description")) {
            JsonNode d = pNode.get("description");
            if (!d.isTextual()) {
                throw new SchemaValidationException("Preset description must be a string.");
            }
            description = d.asText();
        }

        String createdAt = null;
        if (pNode.has("createdAt")) {
            JsonNode c = pNode.get("createdAt");
            if (!c.isTextual()) {
                throw new SchemaValidationException("Preset createdAt must be a string.");
            }
            createdAt = c.asText();
        }

        JsonNode gridNode = pNode.get("grid");
        GridModel grid = parseGridNode(gridNode, index);

        return new GridPreset(id, name, description, grid, createdAt);
    }

    private GridModel parseGridNode(JsonNode gNode, int index) {
        if (gNode == null || !gNode.isObject()) {
            throw new SchemaValidationException("Preset grid at index " + index + " is required and must be an object.");
        }
        Iterator<String> keys = gNode.fieldNames();
        while (keys.hasNext()) {
            String key = keys.next();
            if (!GRID_KEYS.contains(key)) {
                throw new SchemaValidationException("Unexpected property in grid: " + key);
            }
        }

        int rows = requireInt(gNode, "rows");
        int cols = requireInt(gNode, "cols");
        String startNode = requireNonBlankString(gNode, "startNode", "grid.startNode");
        String targetNode = requireNonBlankString(gNode, "targetNode", "grid.targetNode");

        List<CellDefinition> cells = new ArrayList<>();
        if (gNode.has("cells")) {
            JsonNode cellsNode = gNode.get("cells");
            if (!cellsNode.isArray()) {
                throw new SchemaValidationException("Grid 'cells' must be an array.");
            }
            for (int j = 0; j < cellsNode.size(); j++) {
                cells.add(parseCellNode(cellsNode.get(j), j));
            }
        }

        return new GridModel(rows, cols, startNode, targetNode, cells);
    }

    private CellDefinition parseCellNode(JsonNode cNode, int cellIndex) {
        if (cNode == null || !cNode.isObject()) {
            throw new SchemaValidationException("Cell entry at index " + cellIndex + " must be an object.");
        }
        Iterator<String> keys = cNode.fieldNames();
        while (keys.hasNext()) {
            String key = keys.next();
            if (!CELL_KEYS.contains(key)) {
                throw new SchemaValidationException("Unexpected property in cell definition: " + key);
            }
        }

        String id = requireNonBlankString(cNode, "id", "cells[" + cellIndex + "].id");
        int row = requireInt(cNode, "row");
        int col = requireInt(cNode, "col");
        String cellTypeStr = requireNonBlankString(cNode, "cellType", "cells[" + cellIndex + "].cellType");

        CellType cellType;
        try {
            cellType = CellType.valueOf(cellTypeStr);
        } catch (IllegalArgumentException ex) {
            throw new SchemaValidationException("Invalid cellType: " + cellTypeStr);
        }

        int weight = 1;
        if (cNode.has("weight")) {
            weight = requireInt(cNode, "weight");
        }

        return new CellDefinition(id, row, col, cellType, weight);
    }

    private String requireNonBlankString(JsonNode obj, String field, String path) {
        JsonNode node = obj.get(field);
        if (node == null || !node.isTextual() || node.asText().isBlank()) {
            throw new SchemaValidationException("Field '" + path + "' is required and must be a non-blank string.");
        }
        return node.asText();
    }

    private int requireInt(JsonNode obj, String field) {
        JsonNode node = obj.get(field);
        if (node == null || !node.isIntegralNumber() || !node.canConvertToInt()) {
            throw new SchemaValidationException("Field '" + field + "' is required and must be an integer.");
        }
        return node.asInt();
    }

    private Map<String, Object> toCanonicalPresetMap(GridPreset preset) {
        Map<String, Object> map = new TreeMap<>();
        if (preset.getCreatedAt() != null) {
            map.put("createdAt", preset.getCreatedAt());
        }
        if (preset.getDescription() != null) {
            map.put("description", preset.getDescription());
        }
        map.put("grid", toCanonicalGridMap(preset.getGrid()));
        map.put("id", preset.getId());
        map.put("name", preset.getName());
        return map;
    }

    private Map<String, Object> toCanonicalGridMap(GridModel grid) {
        Map<String, Object> map = new TreeMap<>();
        List<Map<String, Object>> cellMaps = new ArrayList<>();
        if (grid.getCells() != null) {
            for (CellDefinition cell : grid.getCells()) {
                Map<String, Object> cMap = new TreeMap<>();
                cMap.put("cellType", cell.getCellType().name());
                cMap.put("col", cell.getCol());
                cMap.put("id", cell.getId());
                cMap.put("row", cell.getRow());
                cMap.put("weight", cell.getWeight());
                cellMaps.add(cMap);
            }
        }
        map.put("cells", cellMaps);
        map.put("cols", grid.getCols());
        map.put("rows", grid.getRows());
        map.put("startNode", grid.getStartNode());
        map.put("targetNode", grid.getTargetNode());
        return map;
    }

    @SuppressWarnings("unchecked")
    private String serializeJson(Object value, boolean pretty, int indentLevel) {
        StringBuilder sb = new StringBuilder();
        writeJson(sb, value, pretty, indentLevel);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private void writeJson(StringBuilder sb, Object value, boolean pretty, int indentLevel) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof Boolean b) {
            sb.append(b ? "true" : "false");
        } else if (value instanceof Integer || value instanceof Long) {
            sb.append(value);
        } else if (value instanceof String s) {
            writeEscapedString(sb, s);
        } else if (value instanceof Map<?, ?> rawMap) {
            TreeMap<String, Object> sorted = new TreeMap<>();
            for (Map.Entry<?, ?> e : rawMap.entrySet()) {
                sorted.put(String.valueOf(e.getKey()), e.getValue());
            }
            if (sorted.isEmpty()) {
                sb.append("{}");
                return;
            }
            sb.append('{');
            int i = 0;
            for (Map.Entry<String, Object> entry : sorted.entrySet()) {
                if (i > 0) sb.append(',');
                if (pretty) {
                    sb.append('\n');
                    appendIndent(sb, indentLevel + 1);
                }
                writeEscapedString(sb, entry.getKey());
                sb.append(pretty ? ": " : ":");
                writeJson(sb, entry.getValue(), pretty, indentLevel + 1);
                i++;
            }
            if (pretty) {
                sb.append('\n');
                appendIndent(sb, indentLevel);
            }
            sb.append('}');
        } else if (value instanceof List<?> list) {
            if (list.isEmpty()) {
                sb.append("[]");
                return;
            }
            sb.append('[');
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(',');
                if (pretty) {
                    sb.append('\n');
                    appendIndent(sb, indentLevel + 1);
                }
                writeJson(sb, list.get(i), pretty, indentLevel + 1);
            }
            if (pretty) {
                sb.append('\n');
                appendIndent(sb, indentLevel);
            }
            sb.append(']');
        } else {
            writeEscapedString(sb, value.toString());
        }
    }

    private void appendIndent(StringBuilder sb, int level) {
        for (int i = 0; i < level; i++) {
            sb.append("  ");
        }
    }

    private void writeEscapedString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (ch < 0x20) {
                        sb.append(String.format("\\u%04x", (int) ch));
                    } else {
                        sb.append(ch);
                    }
                }
            }
        }
        sb.append('"');
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", ex);
        }
    }
}
