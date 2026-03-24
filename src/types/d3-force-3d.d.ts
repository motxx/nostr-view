declare module "d3-force-3d" {
  export interface SimulationNode {
    id?: string | number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
    index?: number;
  }

  export interface SimulationLink<N extends SimulationNode = SimulationNode> {
    source: string | number | N;
    target: string | number | N;
    index?: number;
  }

  export interface Simulation<N extends SimulationNode = SimulationNode> {
    tick(iterations?: number): this;
    nodes(): N[];
    nodes(nodes: N[]): this;
    alpha(): number;
    alpha(alpha: number): this;
    alphaMin(): number;
    alphaMin(min: number): this;
    alphaDecay(): number;
    alphaDecay(decay: number): this;
    alphaTarget(): number;
    alphaTarget(target: number): this;
    velocityDecay(): number;
    velocityDecay(decay: number): this;
    force(name: string): any;
    force(name: string, force: any): this;
    stop(): this;
    restart(): this;
    on(type: string, listener: (() => void) | null): this;
  }

  export function forceSimulation<N extends SimulationNode = SimulationNode>(
    nodes?: N[],
    numDimensions?: number,
  ): Simulation<N>;

  export function forceLink<
    N extends SimulationNode = SimulationNode,
    L extends SimulationLink<N> = SimulationLink<N>,
  >(
    links?: L[],
  ): {
    (alpha: number): void;
    links(): L[];
    links(links: L[]): any;
    id(): (node: N, i: number, nodes: N[]) => string | number;
    id(id: (node: N, i: number, nodes: N[]) => string | number): any;
    distance(): number | ((link: L) => number);
    distance(distance: number | ((link: L) => number)): any;
    strength(): number | ((link: L) => number);
    strength(strength: number | ((link: L) => number)): any;
  };

  export function forceManyBody(): {
    (alpha: number): void;
    strength(): number | ((node: SimulationNode) => number);
    strength(strength: number | ((node: SimulationNode) => number)): any;
    distanceMin(): number;
    distanceMin(min: number): any;
    distanceMax(): number;
    distanceMax(max: number): any;
  };

  export function forceCenter(
    x?: number,
    y?: number,
    z?: number,
  ): {
    (alpha: number): void;
    x(): number;
    x(x: number): any;
    y(): number;
    y(y: number): any;
    z(): number;
    z(z: number): any;
    strength(): number;
    strength(strength: number): any;
  };

  export function forceX(
    x?: number | ((node: SimulationNode) => number),
  ): any;
  export function forceY(
    y?: number | ((node: SimulationNode) => number),
  ): any;
  export function forceZ(
    z?: number | ((node: SimulationNode) => number),
  ): any;
  export function forceCollide(
    radius?: number | ((node: SimulationNode) => number),
  ): any;
}
