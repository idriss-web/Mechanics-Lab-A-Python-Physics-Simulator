import math


class MechanicsError(Exception):
    pass


def _positive(**values):
    for name, v in values.items():
        if not (v > 0):
            raise MechanicsError(f"{name} must be greater than zero")


class Body:
    kind = "body"

    def __init__(self, name):
        self.name = name

    def state0(self, g):
        raise NotImplementedError

    def deriv(self, s, g):
        raise NotImplementedError

    def post_step(self, s, dt):
        return s

    def points(self, s):
        raise NotImplementedError

    def energy(self, s, g):
        raise NotImplementedError

    def signals(self, s, g):
        raise NotImplementedError


class Pendulum(Body):
    kind = "pendulum"

    def __init__(self, name, length=1.5, mass=1.0, angle=45.0, damping=0.05):
        super().__init__(name)
        _positive(length=length, mass=mass)
        self.length, self.mass, self.angle, self.damping = length, mass, angle, damping

    def state0(self, g):
        return [math.radians(self.angle), 0.0]

    def deriv(self, s, g):
        th, w = s
        return [w, -(g / self.length) * math.sin(th) - self.damping * w]

    def points(self, s):
        th = s[0]
        return [[0.0, 0.0], [self.length * math.sin(th), self.length * math.cos(th)]]

    def energy(self, s, g):
        th, w = s
        return (0.5 * self.mass * (self.length * w) ** 2,
                -self.mass * g * self.length * math.cos(th))

    def signals(self, s, g):
        return {"angle (deg)": math.degrees(s[0]), "speed (m/s)": abs(self.length * s[1])}


class SpringMass(Body):
    kind = "spring"

    def __init__(self, name, k=20.0, mass=1.0, rest=1.0, stretch=0.5, damping=0.1, horizontal=False):
        super().__init__(name)
        _positive(k=k, mass=mass, rest=rest)
        self.k, self.mass, self.rest, self.stretch = k, mass, rest, stretch
        self.damping, self.horizontal = damping, bool(horizontal)

    def state0(self, g):
        return [self.rest + self.stretch, 0.0]

    def deriv(self, s, g):
        x, v = s
        grav = 0.0 if self.horizontal else g
        return [v, grav - self.k / self.mass * (x - self.rest) - self.damping / self.mass * v]

    def points(self, s):
        return [[0.0, 0.0], [s[0], 0.0] if self.horizontal else [0.0, s[0]]]

    def energy(self, s, g):
        x, v = s
        pe = 0.5 * self.k * (x - self.rest) ** 2
        if not self.horizontal:
            pe -= self.mass * g * x
        return 0.5 * self.mass * v * v, pe

    def signals(self, s, g):
        return {"extension (m)": s[0] - self.rest, "velocity (m/s)": s[1]}


class Ball(Body):
    kind = "ball"

    def __init__(self, name, speed=6.0, angle=50.0, mass=1.0, restitution=0.75, drag=0.05, height=2.0):
        super().__init__(name)
        _positive(mass=mass, height=height)
        if not (0 <= restitution <= 1):
            raise MechanicsError("restitution must be between 0 and 1")
        self.speed, self.angle, self.mass = speed, angle, mass
        self.restitution, self.drag, self.height = restitution, drag, height
        self.radius = (8 + 4 * math.sqrt(mass)) / 100

    def state0(self, g):
        a = math.radians(self.angle)
        return [0.0, self.height, self.speed * math.cos(a), self.speed * math.sin(a)]

    def deriv(self, s, g):
        x, y, vx, vy = s
        return [vx, vy, -self.drag * vx, -g - self.drag * vy]

    def post_step(self, s, dt):
        x, y, vx, vy = s
        if y <= self.radius:
            y = self.radius
            if vy < 0:
                vy = -self.restitution * vy
                if abs(vy) < 0.4:
                    vy = 0.0
            vx *= math.exp(-1.5 * dt)
        return [x, y, vx, vy]

    def points(self, s):
        return [[s[0], -(s[1] - self.height)]]

    def energy(self, s, g):
        x, y, vx, vy = s
        return 0.5 * self.mass * (vx * vx + vy * vy), self.mass * g * (y - self.radius)

    def signals(self, s, g):
        return {"height (m)": s[1], "speed (m/s)": math.hypot(s[2], s[3])}


class DoublePendulum(Body):
    kind = "double"

    def __init__(self, name, l1=1.0, l2=1.0, m1=1.0, m2=1.0, angle1=120.0, angle2=-10.0, damping=0.0):
        super().__init__(name)
        _positive(l1=l1, l2=l2, m1=m1, m2=m2)
        self.l1, self.l2, self.m1, self.m2 = l1, l2, m1, m2
        self.angle1, self.angle2, self.damping = angle1, angle2, damping

    def state0(self, g):
        return [math.radians(self.angle1), 0.0, math.radians(self.angle2), 0.0]

    def deriv(self, s, g):
        t1, w1, t2, w2 = s
        m1, m2, l1, l2 = self.m1, self.m2, self.l1, self.l2
        d = t1 - t2
        den = 2 * m1 + m2 - m2 * math.cos(2 * d)
        a1 = (-g * (2 * m1 + m2) * math.sin(t1) - m2 * g * math.sin(t1 - 2 * t2)
              - 2 * math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * math.cos(d))) / (l1 * den)
        a2 = (2 * math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * math.cos(t1)
              + w2 * w2 * l2 * m2 * math.cos(d))) / (l2 * den)
        return [w1, a1 - self.damping * w1, w2, a2 - self.damping * w2]

    def points(self, s):
        t1, _, t2, _ = s
        p1 = [self.l1 * math.sin(t1), self.l1 * math.cos(t1)]
        return [[0.0, 0.0], p1, [p1[0] + self.l2 * math.sin(t2), p1[1] + self.l2 * math.cos(t2)]]

    def energy(self, s, g):
        t1, w1, t2, w2 = s
        v1sq = (self.l1 * w1) ** 2
        v2sq = v1sq + (self.l2 * w2) ** 2 + 2 * self.l1 * self.l2 * w1 * w2 * math.cos(t1 - t2)
        ke = 0.5 * self.m1 * v1sq + 0.5 * self.m2 * v2sq
        pe = -(self.m1 + self.m2) * g * self.l1 * math.cos(t1) - self.m2 * g * self.l2 * math.cos(t2)
        return ke, pe

    def signals(self, s, g):
        return {"angle 1 (deg)": math.degrees(s[0]), "angle 2 (deg)": math.degrees(s[2])}


class Orbit(Body):
    kind = "orbit"

    def __init__(self, name, mu=4.0, distance=1.5, speed_factor=0.8, mass=1.0):
        super().__init__(name)
        _positive(mu=mu, distance=distance, mass=mass)
        self.mu, self.distance, self.speed_factor, self.mass = mu, distance, speed_factor, mass

    def state0(self, g):
        return [self.distance, 0.0, 0.0, self.speed_factor * math.sqrt(self.mu / self.distance)]

    def deriv(self, s, g):
        x, y, vx, vy = s
        r3 = (x * x + y * y) ** 1.5
        return [vx, vy, -self.mu * x / r3, -self.mu * y / r3]

    def points(self, s):
        return [[0.0, 0.0], [s[0], -s[1]]]

    def energy(self, s, g):
        r = math.hypot(s[0], s[1])
        return 0.5 * self.mass * (s[2] ** 2 + s[3] ** 2), -self.mass * self.mu / r

    def signals(self, s, g):
        return {"distance (m)": math.hypot(s[0], s[1]), "speed (m/s)": math.hypot(s[2], s[3])}


BODY_TYPES = {
    "pendulum": Pendulum,
    "spring": SpringMass,
    "ball": Ball,
    "double": DoublePendulum,
    "orbit": Orbit,
}
