using System.Text.RegularExpressions;

namespace Aetheris.Core.Algorithm;

public static class NodeIdUtil
{
    private static readonly Regex Regex = new(@"^r(\d+)c(\d+)$", RegexOptions.Compiled);

    public static string Format(int row, int col) => $"r{row}c{col}";

    public static (int row, int col) Parse(string id)
    {
        var match = Regex.Match(id);
        if (!match.Success)
        {
            throw new ArgumentException($"Invalid node id format: {id}");
        }
        return (int.Parse(match.Groups[1].Value), int.Parse(match.Groups[2].Value));
    }
}
