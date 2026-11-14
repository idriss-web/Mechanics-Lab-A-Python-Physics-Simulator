import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from physics import Ball, DoublePendulum, MechanicsError, Orbit, Pendulum, SpringMass, World


def first_zero_time(out, name, key):
    data = out["objects"][name]["signals"][key]
    for i in range(1, len(data)):
        if data[i - 1] > 0 >= data[i] or data[i - 1] < 0 <= data[i]:
            frac = abs(data[i - 1]) / (abs(data[i - 1]) + abs(data[i]))
            return out["t"][i - 1] + frac / out["fps"]


class Tests(unittest.TestCase):
    def test_pendulum_period(self):
        w = World()
        w.add(Pendulum("P1", length=1.0, angle=2.0, damping=0.0))
        out = w.simulate(t_end=2, fps=120)
        quarter = first_zero_time(out, "P1", "angle (deg)")
        self.assertAlmostEqual(quarter * 4, 2 * math.pi * math.sqrt(1 / 9.81), delta=0.01)

    def test_spring_period(self):
        w = World()
        w.add(SpringMass("S1", k=20, mass=1, damping=0, horizontal=True))
        out = w.simulate(t_end=2, fps=120)
        quarter = first_zero_time(out, "S1", "extension (m)")
        self.assertAlmostEqual(quarter * 4, 2 * math.pi * math.sqrt(1 / 20), delta=0.01)

    def test_double_pendulum_energy_conserved(self):
        w = World()
        w.add(DoublePendulum("D1", damping=0))
        e = w.simulate(t_end=5)["objects"]["D1"]["energy"]["total"]
        self.assertLess(max(e) - min(e), 1e-3 * abs(e[0]) + 1e-3)

    def test_projectile_apex(self):
        w = World()
        w.add(Ball("B1", speed=10, angle=45, drag=0, height=2))
        out = w.simulate(t_end=2, fps=120)
        top = max(out["objects"]["B1"]["signals"]["height (m)"])
        self.assertAlmostEqual(top, 2 + (10 * math.sin(math.pi / 4)) ** 2 / (2 * 9.81), delta=0.01)

    def test_ball_comes_to_rest(self):
        w = World()
        w.add(Ball("B1", speed=0, angle=0, restitution=0.5, drag=0, height=1))
        h = w.simulate(t_end=8)["objects"]["B1"]["signals"]["height (m)"]
        self.assertAlmostEqual(h[-1], (8 + 4) / 100, places=3)

    def test_circular_orbit(self):
        w = World()
        w.add(Orbit("O1", speed_factor=1.0))
        d = w.simulate(t_end=10)["objects"]["O1"]["signals"]["distance (m)"]
        self.assertLess(max(d) - min(d), 1e-3)

    def test_bad_input(self):
        with self.assertRaises(MechanicsError):
            Pendulum("P", length=0)
        with self.assertRaises(MechanicsError):
            World.from_dict({"objects": [{"id": "X", "type": "nope"}]})


if __name__ == "__main__":
    unittest.main()
