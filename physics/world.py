from .bodies import BODY_TYPES, MechanicsError


def rk4(body, s, dt, g):
    k1 = body.deriv(s, g)
    k2 = body.deriv([a + 0.5 * dt * b for a, b in zip(s, k1)], g)
    k3 = body.deriv([a + 0.5 * dt * b for a, b in zip(s, k2)], g)
    k4 = body.deriv([a + dt * b for a, b in zip(s, k3)], g)
    return [a + dt / 6 * (p + 2 * q + 2 * r + w) for a, p, q, r, w in zip(s, k1, k2, k3, k4)]


def _round(x):
    return round(x, 5)


class World:
    def __init__(self, gravity=9.81):
        if gravity < 0:
            raise MechanicsError("gravity cannot be negative")
        self.gravity = float(gravity)
        self.bodies = []

    def add(self, body):
        if any(b.name == body.name for b in self.bodies):
            raise MechanicsError(f"Duplicate object name {body.name!r}")
        self.bodies.append(body)
        return body

    @classmethod
    def from_dict(cls, data):
        w = cls(float(data.get("gravity", 9.81)))
        for spec in data.get("objects", []):
            klass = BODY_TYPES.get(spec["type"])
            if klass is None:
                raise MechanicsError(f"Unknown object type {spec['type']!r}")
            try:
                w.add(klass(spec["id"], **spec.get("params", {})))
            except TypeError as e:
                raise MechanicsError(f"Bad parameters for {spec['id']}: {e}")
        return w

    def simulate(self, t_end=10.0, fps=60, substeps=8):
        if t_end <= 0:
            raise MechanicsError("Duration must be positive")
        frames = int(t_end * fps) + 1
        if frames * substeps * max(1, len(self.bodies)) > 900_000:
            raise MechanicsError("Simulation too long. Shorten the duration.")
        dt = 1.0 / (fps * substeps)
        g = self.gravity
        out = {"fps": fps, "t": [_round(i / fps) for i in range(frames)], "objects": {}}
        for body in self.bodies:
            s = body.state0(g)
            pts, ke, pe = [], [], []
            sig = {}
            for f in range(frames):
                if f:
                    for _ in range(substeps):
                        s = body.post_step(rk4(body, s, dt, g), dt)
                pts.append([[_round(x), _round(y)] for x, y in body.points(s)])
                k, p = body.energy(s, g)
                ke.append(_round(k))
                pe.append(_round(p))
                for name, val in body.signals(s, g).items():
                    sig.setdefault(name, []).append(_round(val))
            out["objects"][body.name] = {
                "pts": pts,
                "signals": sig,
                "energy": {"ke": ke, "pe": pe, "total": [_round(a + b) for a, b in zip(ke, pe)]},
            }
        return out
