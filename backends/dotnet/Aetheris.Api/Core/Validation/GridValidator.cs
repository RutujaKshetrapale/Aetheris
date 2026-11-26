using System.Text.RegularExpressions;
using Aetheris.Core.Algorithm;
using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;

namespace Aetheris.Core.Validation;

public static partial class GridValidator
{
    [GeneratedRegex("^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$")]
    private static partial Regex ResourceIdRegex();

    [GeneratedRegex("^r[0-9]+c[0-9]+$")]
    private static partial Regex NodeIdRegex();

    public static void ValidateResourceId(string? id, string resourceName)
    {
        if (string.IsNullOrWhiteSpace(id) || !ResourceIdRegex().IsMatch(id))
        {
            throw new SchemaValidationException(
                $"{resourceName} ID must be 1-64 alphanumeric, dot, underscore, or hyphen characters.",
                new Dictionary<string, object> { ["field"] = "id", ["rule"] = "pattern" });
        }
    }

    public static void ValidatePathfindingRequest(PathfindingRequest? request)
    {
        if (request == null)
            throw new SchemaValidationException("Pathfinding request cannot be null");

        if (!Enum.IsDefined(request.Algorithm))
            throw new SchemaValidationException("Algorithm must be a valid AlgorithmType",
                new Dictionary<string, object> { ["field"] = "algorithm" });

        if (!Enum.IsDefined(request.Heuristic))
            throw new SchemaValidationException("Heuristic must be a valid HeuristicType",
                new Dictionary<string, object> { ["field"] = "heuristic" });

        ValidateGrid(request.Grid);
    }

    public static void ValidateGrid(GridModel? grid)
    {
        if (grid == null)
            throw new SchemaValidationException("Grid model cannot be null",
                new Dictionary<string, object> { ["field"] = "grid" });

        int rows = grid.Rows;
        int cols = grid.Cols;
        if (rows < 1 || cols < 1 || rows > 200 || cols > 200)
        {
            throw new SchemaValidationException(
                $"Grid dimensions must be integers between 1 and 200: rows={rows}, cols={cols}",
                new Dictionary<string, object> { ["rows"] = rows, ["cols"] = cols });
        }

        string startNode = grid.StartNode;
        string targetNode = grid.TargetNode;
        if (string.IsNullOrWhiteSpace(startNode) || string.IsNullOrWhiteSpace(targetNode))
            throw new SchemaValidationException("Start node and target node are required");

        if (!NodeIdRegex().IsMatch(startNode))
            throw new SchemaValidationException($"Invalid startNode format: {startNode}",
                new Dictionary<string, object> { ["field"] = "grid.startNode" });

        if (!NodeIdRegex().IsMatch(targetNode))
            throw new SchemaValidationException($"Invalid targetNode format: {targetNode}",
                new Dictionary<string, object> { ["field"] = "grid.targetNode" });

        var (startR, startC) = ParseCoordinatesOrSchemaFail(startNode, "grid.startNode");
        var (targetR, targetC) = ParseCoordinatesOrSchemaFail(targetNode, "grid.targetNode");

        // Schema checks on all cells first (HTTP 400)
        if (grid.Cells != null)
        {
            for (int i = 0; i < grid.Cells.Count; i++)
            {
                var cd = grid.Cells[i];
                if (cd == null || string.IsNullOrWhiteSpace(cd.Id) || !Enum.IsDefined(cd.CellType))
                    throw new SchemaValidationException("Cell definition must have id and cellType",
                        new Dictionary<string, object> { ["index"] = i });

                if (!NodeIdRegex().IsMatch(cd.Id))
                    throw new SchemaValidationException($"Invalid cell id format: {cd.Id}",
                        new Dictionary<string, object> { ["cellId"] = cd.Id });

                if (cd.Row < 0 || cd.Col < 0)
                    throw new SchemaValidationException($"Cell row and col must be non-negative: {cd.Id}",
                        new Dictionary<string, object> { ["cellId"] = cd.Id });

                if (cd.Weight < 1 || cd.Weight > 100)
                    throw new SchemaValidationException($"Cell weight must be between 1 and 100: {cd.Id}",
                        new Dictionary<string, object> { ["cellId"] = cd.Id });
            }
        }

        // Domain checks (HTTP 422)
        if (startR < 0 || startR >= rows || startC < 0 || startC >= cols)
            throw new DomainValidationException($"Start node out of bounds: {startNode}",
                new Dictionary<string, object> { ["nodeId"] = startNode, ["rows"] = rows, ["cols"] = cols });

        if (targetR < 0 || targetR >= rows || targetC < 0 || targetC >= cols)
            throw new DomainValidationException($"Target node out of bounds: {targetNode}",
                new Dictionary<string, object> { ["nodeId"] = targetNode, ["rows"] = rows, ["cols"] = cols });

        if (grid.Cells != null)
        {
            var seenIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (var cd in grid.Cells)
            {
                var (r, c) = ParseCoordinatesOrSchemaFail(cd.Id, "grid.cells");
                if (r < 0 || r >= rows || c < 0 || c >= cols)
                    throw new DomainValidationException($"Cell {cd.Id} out of bounds",
                        new Dictionary<string, object> { ["cellId"] = cd.Id, ["rows"] = rows, ["cols"] = cols });

                if (r != cd.Row || c != cd.Col)
                    throw new DomainValidationException($"Cell id does not match coordinates for {cd.Id}",
                        new Dictionary<string, object> { ["cellId"] = cd.Id });

                if (!seenIds.Add(cd.Id))
                    throw new DomainValidationException($"Duplicate cell definition for {cd.Id}",
                        new Dictionary<string, object> { ["cellId"] = cd.Id });

                if (cd.CellType == CellType.WEIGHTED && (cd.Weight < 2 || cd.Weight > 100))
                    throw new DomainValidationException($"Weighted cell must have integer weight between 2 and 100: {cd.Id}",
                        new Dictionary<string, object> { ["cellId"] = cd.Id, ["weight"] = cd.Weight });

                if ((cd.Id == startNode || cd.Id == targetNode) && cd.CellType == CellType.WALL)
                    throw new DomainValidationException($"Start or target node cannot be a WALL: {cd.Id}",
                        new Dictionary<string, object> { ["cellId"] = cd.Id });

                if (startNode != targetNode)
                {
                    if (cd.Id == startNode && cd.CellType == CellType.TARGET)
                        throw new DomainValidationException($"Start node cannot be marked as TARGET: {cd.Id}",
                            new Dictionary<string, object> { ["cellId"] = cd.Id });

                    if (cd.Id == targetNode && cd.CellType == CellType.START)
                        throw new DomainValidationException($"Target node cannot be marked as START: {cd.Id}",
                            new Dictionary<string, object> { ["cellId"] = cd.Id });
                }
            }
        }
    }

    private static (int Row, int Col) ParseCoordinatesOrSchemaFail(string nodeId, string field)
    {
        try
        {
            return NodeIdUtil.Parse(nodeId);
        }
        catch (Exception ex)
        {
            throw new SchemaValidationException($"Invalid node id format: {nodeId}", ex);
        }
    }
}
