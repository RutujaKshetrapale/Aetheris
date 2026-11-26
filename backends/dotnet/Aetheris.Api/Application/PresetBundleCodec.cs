using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;
using Aetheris.Core.Validation;

namespace Aetheris.Application;

public partial class PresetBundleCodec
{
    public const string BundleFormat = "aetheris-preset-bundle";
    public const string BundleFormatVersion = "1.0.0";

    private static readonly HashSet<string> BundleKeys = new(StringComparer.Ordinal) { "format", "formatVersion", "exportedAt", "contentHash", "presets" };
    private static readonly HashSet<string> PresetKeys = new(StringComparer.Ordinal) { "id", "name", "description", "grid", "createdAt" };
    private static readonly HashSet<string> GridKeys = new(StringComparer.Ordinal) { "rows", "cols", "startNode", "targetNode", "cells" };
    private static readonly HashSet<string> CellKeys = new(StringComparer.Ordinal) { "id", "row", "col", "cellType", "weight" };

    [GeneratedRegex("^[a-f0-9]{64}$")]
    private static partial Regex Sha256Regex();

    private static readonly UTF8Encoding Utf8NoBom = new(encoderShouldEmitUTF8Identifier: false);

    public byte[] EncodePretty(IEnumerable<GridPreset> presets)
    {
        var presetMaps = new List<SortedDictionary<string, object?>>();
        foreach (var preset in presets)
        {
            presetMaps.Add(ToCanonicalPresetMap(preset));
        }

        var hashCore = new SortedDictionary<string, object?>(StringComparer.Ordinal)
        {
            ["format"] = BundleFormat,
            ["formatVersion"] = BundleFormatVersion,
            ["presets"] = presetMaps
        };

        string compactCore = SerializeJson(hashCore, pretty: false, indentLevel: 0);
        string contentHash = ComputeSha256Hex(compactCore);

        var bundle = new SortedDictionary<string, object?>(StringComparer.Ordinal)
        {
            ["contentHash"] = contentHash,
            ["exportedAt"] = DateTime.UtcNow.ToString("O"),
            ["format"] = BundleFormat,
            ["formatVersion"] = BundleFormatVersion,
            ["presets"] = presetMaps
        };

        string pretty = SerializeJson(bundle, pretty: true, indentLevel: 0);
        return Utf8NoBom.GetBytes(pretty);
    }

    public List<GridPreset> DecodeAndValidate(byte[] rawBytes)
    {
        if (rawBytes == null || rawBytes.Length == 0)
            throw new SchemaValidationException("Import bundle body cannot be empty.");

        if (rawBytes.Length >= 3 && rawBytes[0] == 0xEF && rawBytes[1] == 0xBB && rawBytes[2] == 0xBF)
            throw new SchemaValidationException("Import bundle must use UTF-8 without BOM.");

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(rawBytes, new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow
            });
        }
        catch (JsonException)
        {
            throw new SchemaValidationException("Import bundle contains malformed JSON.");
        }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                throw new SchemaValidationException("Import bundle must be a JSON object.");

            foreach (var prop in root.EnumerateObject())
            {
                if (!BundleKeys.Contains(prop.Name))
                    throw new SchemaValidationException($"Unexpected property in preset bundle: {prop.Name}");
            }

            if (!root.TryGetProperty("format", out var formatEl) || formatEl.ValueKind != JsonValueKind.String)
                throw new SchemaValidationException("Preset bundle 'format' field is required and must be a string.");

            string formatStr = formatEl.GetString()!;
            if (!string.Equals(formatStr, BundleFormat, StringComparison.Ordinal))
                throw new DomainValidationException($"Incompatible preset bundle format: {formatStr}");

            if (!root.TryGetProperty("formatVersion", out var versionEl) || versionEl.ValueKind != JsonValueKind.String)
                throw new SchemaValidationException("Preset bundle 'formatVersion' field is required and must be a string.");

            string versionStr = versionEl.GetString()!;
            if (!string.Equals(versionStr, BundleFormatVersion, StringComparison.Ordinal))
                throw new DomainValidationException($"Incompatible preset bundle formatVersion: {versionStr}");

            if (root.TryGetProperty("exportedAt", out var exportedAtEl) && exportedAtEl.ValueKind != JsonValueKind.String)
                throw new SchemaValidationException("Preset bundle 'exportedAt' must be a string.");

            if (!root.TryGetProperty("presets", out var presetsEl) || presetsEl.ValueKind != JsonValueKind.Array)
                throw new SchemaValidationException("Preset bundle 'presets' field is required and must be an array.");

            var imported = new List<GridPreset>();
            var canonicalForHash = new List<SortedDictionary<string, object?>>();

            int idx = 0;
            foreach (var pEl in presetsEl.EnumerateArray())
            {
                var preset = ParsePresetElement(pEl, idx);
                GridValidator.ValidateGrid(preset.Grid);
                imported.Add(preset);
                canonicalForHash.Add(ToCanonicalPresetMap(preset));
                idx++;
            }

            if (root.TryGetProperty("contentHash", out var hashEl))
            {
                if (hashEl.ValueKind != JsonValueKind.String)
                    throw new SchemaValidationException("Preset bundle 'contentHash' must be a string.");

                string providedHash = hashEl.GetString()!;
                if (!Sha256Regex().IsMatch(providedHash))
                    throw new SchemaValidationException("Preset bundle 'contentHash' must be a 64-character lowercase SHA-256 hex digest.");

                var hashCore = new SortedDictionary<string, object?>(StringComparer.Ordinal)
                {
                    ["format"] = BundleFormat,
                    ["formatVersion"] = BundleFormatVersion,
                    ["presets"] = canonicalForHash
                };
                string expectedHash = ComputeSha256Hex(SerializeJson(hashCore, pretty: false, indentLevel: 0));
                if (!string.Equals(expectedHash, providedHash, StringComparison.Ordinal))
                    throw new DomainValidationException("Preset bundle contentHash mismatch; bundle integrity verification failed.");
            }

            return imported;
        }
    }

    private static GridPreset ParsePresetElement(JsonElement pEl, int index)
    {
        if (pEl.ValueKind != JsonValueKind.Object)
            throw new SchemaValidationException($"Preset entry at index {index} must be a JSON object.");

        foreach (var prop in pEl.EnumerateObject())
        {
            if (!PresetKeys.Contains(prop.Name))
                throw new SchemaValidationException($"Unexpected property in preset entry: {prop.Name}");
        }

        string id = RequireNonBlankString(pEl, "id", $"presets[{index}].id");
        GridValidator.ValidateResourceId(id, "Preset");
        string name = RequireNonBlankString(pEl, "name", $"presets[{index}].name");

        string? description = null;
        if (pEl.TryGetProperty("description", out var descEl))
        {
            if (descEl.ValueKind != JsonValueKind.String)
                throw new SchemaValidationException("Preset description must be a string.");
            description = descEl.GetString();
        }

        string? createdAt = null;
        if (pEl.TryGetProperty("createdAt", out var createdEl))
        {
            if (createdEl.ValueKind != JsonValueKind.String)
                throw new SchemaValidationException("Preset createdAt must be a string.");
            createdAt = createdEl.GetString();
        }

        if (!pEl.TryGetProperty("grid", out var gridEl))
            throw new SchemaValidationException($"Preset grid at index {index} is required.");

        var grid = ParseGridElement(gridEl, index);
        return new GridPreset(id, name, description, grid, createdAt);
    }

    private static GridModel ParseGridElement(JsonElement gEl, int index)
    {
        if (gEl.ValueKind != JsonValueKind.Object)
            throw new SchemaValidationException($"Preset grid at index {index} must be an object.");

        foreach (var prop in gEl.EnumerateObject())
        {
            if (!GridKeys.Contains(prop.Name))
                throw new SchemaValidationException($"Unexpected property in grid: {prop.Name}");
        }

        int rows = RequireInt(gEl, "rows");
        int cols = RequireInt(gEl, "cols");
        string startNode = RequireNonBlankString(gEl, "startNode", "grid.startNode");
        string targetNode = RequireNonBlankString(gEl, "targetNode", "grid.targetNode");

        var cells = new List<CellDefinition>();
        if (gEl.TryGetProperty("cells", out var cellsEl))
        {
            if (cellsEl.ValueKind != JsonValueKind.Array)
                throw new SchemaValidationException("Grid 'cells' must be an array.");

            int cellIdx = 0;
            foreach (var cEl in cellsEl.EnumerateArray())
            {
                cells.Add(ParseCellElement(cEl, cellIdx++));
            }
        }

        return new GridModel(rows, cols, startNode, targetNode, cells);
    }

    private static CellDefinition ParseCellElement(JsonElement cEl, int cellIndex)
    {
        if (cEl.ValueKind != JsonValueKind.Object)
            throw new SchemaValidationException($"Cell entry at index {cellIndex} must be an object.");

        foreach (var prop in cEl.EnumerateObject())
        {
            if (!CellKeys.Contains(prop.Name))
                throw new SchemaValidationException($"Unexpected property in cell definition: {prop.Name}");
        }

        string id = RequireNonBlankString(cEl, "id", $"cells[{cellIndex}].id");
        int row = RequireInt(cEl, "row");
        int col = RequireInt(cEl, "col");
        string cellTypeStr = RequireNonBlankString(cEl, "cellType", $"cells[{cellIndex}].cellType");

        if (!Enum.TryParse<CellType>(cellTypeStr, ignoreCase: false, out var cellType) || !Enum.IsDefined(cellType))
            throw new SchemaValidationException($"Invalid cellType: {cellTypeStr}");

        int weight = 1;
        if (cEl.TryGetProperty("weight", out _))
        {
            weight = RequireInt(cEl, "weight");
        }

        return new CellDefinition(id, row, col, cellType, weight);
    }

    private static string RequireNonBlankString(JsonElement obj, string field, string path)
    {
        if (!obj.TryGetProperty(field, out var el) || el.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(el.GetString()))
            throw new SchemaValidationException($"Field '{path}' is required and must be a non-blank string.");
        return el.GetString()!;
    }

    private static int RequireInt(JsonElement obj, string field)
    {
        if (!obj.TryGetProperty(field, out var el) || el.ValueKind != JsonValueKind.Number || !el.TryGetInt32(out int val))
            throw new SchemaValidationException($"Field '{field}' is required and must be an integer.");
        // Reject fractional numbers like 5.0
        string raw = el.GetRawText();
        if (raw.Contains('.') || raw.Contains('e') || raw.Contains('E'))
            throw new SchemaValidationException($"Field '{field}' must be an integer without fractional notation.");
        return val;
    }

    private static SortedDictionary<string, object?> ToCanonicalPresetMap(GridPreset preset)
    {
        var map = new SortedDictionary<string, object?>(StringComparer.Ordinal);
        if (preset.CreatedAt != null)
            map["createdAt"] = preset.CreatedAt;
        if (preset.Description != null)
            map["description"] = preset.Description;
        map["grid"] = ToCanonicalGridMap(preset.Grid);
        map["id"] = preset.Id;
        map["name"] = preset.Name;
        return map;
    }

    private static SortedDictionary<string, object?> ToCanonicalGridMap(GridModel grid)
    {
        var cellMaps = new List<SortedDictionary<string, object?>>();
        if (grid.Cells != null)
        {
            foreach (var cell in grid.Cells)
            {
                cellMaps.Add(new SortedDictionary<string, object?>(StringComparer.Ordinal)
                {
                    ["cellType"] = cell.CellType.ToString(),
                    ["col"] = cell.Col,
                    ["id"] = cell.Id,
                    ["row"] = cell.Row,
                    ["weight"] = cell.Weight
                });
            }
        }

        return new SortedDictionary<string, object?>(StringComparer.Ordinal)
        {
            ["cells"] = cellMaps,
            ["cols"] = grid.Cols,
            ["rows"] = grid.Rows,
            ["startNode"] = grid.StartNode,
            ["targetNode"] = grid.TargetNode
        };
    }

    private static string SerializeJson(object? value, bool pretty, int indentLevel)
    {
        var sb = new StringBuilder();
        WriteJson(sb, value, pretty, indentLevel);
        return sb.ToString();
    }

    private static void WriteJson(StringBuilder sb, object? value, bool pretty, int indentLevel)
    {
        switch (value)
        {
            case null:
                sb.Append("null");
                break;
            case bool b:
                sb.Append(b ? "true" : "false");
                break;
            case int i:
                sb.Append(i);
                break;
            case long l:
                sb.Append(l);
                break;
            case string s:
                WriteEscapedString(sb, s);
                break;
            case IDictionary<string, object?> dict:
                var sorted = new SortedDictionary<string, object?>(dict, StringComparer.Ordinal);
                if (sorted.Count == 0)
                {
                    sb.Append("{}");
                    break;
                }
                sb.Append('{');
                int k = 0;
                foreach (var kvp in sorted)
                {
                    if (k > 0) sb.Append(',');
                    if (pretty)
                    {
                        sb.Append('\n');
                        AppendIndent(sb, indentLevel + 1);
                    }
                    WriteEscapedString(sb, kvp.Key);
                    sb.Append(pretty ? ": " : ":");
                    WriteJson(sb, kvp.Value, pretty, indentLevel + 1);
                    k++;
                }
                if (pretty)
                {
                    sb.Append('\n');
                    AppendIndent(sb, indentLevel);
                }
                sb.Append('}');
                break;
            case System.Collections.IList list:
                if (list.Count == 0)
                {
                    sb.Append("[]");
                    break;
                }
                sb.Append('[');
                for (int i = 0; i < list.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    if (pretty)
                    {
                        sb.Append('\n');
                        AppendIndent(sb, indentLevel + 1);
                    }
                    WriteJson(sb, list[i], pretty, indentLevel + 1);
                }
                if (pretty)
                {
                    sb.Append('\n');
                    AppendIndent(sb, indentLevel);
                }
                sb.Append(']');
                break;
            default:
                WriteEscapedString(sb, value.ToString() ?? string.Empty);
                break;
        }
    }

    private static void AppendIndent(StringBuilder sb, int level)
    {
        for (int i = 0; i < level; i++) sb.Append("  ");
    }

    private static void WriteEscapedString(StringBuilder sb, string s)
    {
        sb.Append('"');
        foreach (char ch in s)
        {
            switch (ch)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (ch < 0x20)
                        sb.Append($"\\u{(int)ch:x4}");
                    else
                        sb.Append(ch);
                    break;
            }
        }
        sb.Append('"');
    }

    private static string ComputeSha256Hex(string input)
    {
        byte[] bytes = SHA256.HashData(Utf8NoBom.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
