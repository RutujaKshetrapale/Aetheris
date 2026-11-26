using Aetheris.Core.Domain;

namespace Aetheris.Core.Algorithm;

public static class HeuristicCalculator
{
    public static int Calculate(HeuristicType type, int r1, int c1, int r2, int c2, int minWeight = 1)
    {
        int weight = Math.Max(1, minWeight);
        return (Math.Abs(r1 - r2) + Math.Abs(c1 - c2)) * weight;
    }
}
