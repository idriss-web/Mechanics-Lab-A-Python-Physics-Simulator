import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from physics import Ball, Pendulum, SpringMass, World

world = World(gravity=9.81)
pend = world.add(Pendulum("P1", length=1.0, angle=10, damping=0))
spring = world.add(SpringMass("S1", k=40, mass=1, damping=0))
ball = world.add(Ball("B1", speed=8, angle=60, height=1.5))

out = world.simulate(t_end=5)
print(f"Pendulum period (small angle): {2 * math.pi * math.sqrt(pend.length / 9.81):.3f} s")
print(f"Spring period: {2 * math.pi * math.sqrt(spring.mass / spring.k):.3f} s")
print(f"Ball peak height: {max(out['objects']['B1']['signals']['height (m)']):.2f} m")
