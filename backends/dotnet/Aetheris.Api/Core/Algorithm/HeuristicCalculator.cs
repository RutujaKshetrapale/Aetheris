using Aetheris.Core.Domain;

namespace Aetheris.Core.Algorithm;

public static class HeuristicCalculator
{
    public static double Calculate(HeuristicType type, int r1, int c1, int r2, int c2)
    {
        return type switch
        {
            HeuristicType.EUCLIDEAN => Math.Sqrt(Math.Pow(r1 - r2, 2) + Math.Pow(c1 - c2, 2)),
            HeuristicType.CHEBYSHEV => Math.Max(Math.Abs(r1 - r2), Math.Abs(c1 - c2)),
            _ => Math.Abs(r1 - r2) + Math.Abs(c1 - c2)
        };
    }
}
