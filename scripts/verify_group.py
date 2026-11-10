"""Optional independent group-size verification: python -m pip install sympy.

Each of 16 pieces has four distinguishable direction markers, so the action on
64 markers faithfully represents both its position and its C4 orientation.
"""
from sympy.combinatorics import Permutation, PermutationGroup

generators = []
for row, col in [(0, 0), (0, 1), (1, 0), (1, 1)]:
    permutation = list(range(64))
    for r in range(3):
        for c in range(3):
            source = (row + r) * 4 + col + c
            target = (row + c) * 4 + col + 2 - r
            for direction in range(4):
                permutation[source * 4 + direction] = target * 4 + (direction + 1) % 4
    generators.append(Permutation(permutation))
group = PermutationGroup(generators)
order = group.order()
assert order == 1745584660257177600
print(f"Reachable states: {order:,}")
print("Faithful action on 64 direction markers; orbit sizes:", [len(o) for o in group.orbits()])
