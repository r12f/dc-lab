/** Starting source of a new topology: the generic example of spec/10-topology-compiler.md. */
export const SAMPLE_TOPOLOGY = `topology: example-backend
version: 1

# 1. VIRTUAL: device set groups and how they connect. No physical location.
device_set_groups:
  server:
    role: server
    count: 64
    partitions:
      - { key: su, count: 4 }
    ports:
      nic: p{1-8}

  t0:
    role: tor
    count: 32
    partitions:
      - { key: su,    count: 4 }
      - { key: plane, count: 8 }
    ports:
      down:                       # 8 ports per server rack of the su, racks in member order
        - etp{1-4}{a,b}           # slot 1
        - etp{5-8}{a,b}           # slot 2
      up: etp{9-10}{a-d}

  t1:
    role: leaf
    count: 16
    partitions:
      - { key: plane, count: 4 }
    ports:
      down: etp{1-8}
      up:   etp{9-10}

  t2:
    role: spine
    count: 8
    partitions:
      - { key: plane, count: 2 }
    ports:
      down: etp{1-16}

topo:
  - name: server-t0               # in each su, every server to every T0
    from: { group: server, key: "\${su}", ports: nic }
    to:   { group: t0,     key: "\${su}", ports: down }
    pattern: { type: mesh, per_pair: 1 }

  - name: t0-t1                   # two T0 planes mesh with one T1 plane
    from: { group: t0, key: "\${plane}", ports: up }
    to:   { group: t1, key: "\${plane}", ports: down }
    map:
      - { from: ["1", "5"], to: "1" }
      - { from: ["2", "6"], to: "2" }
      - { from: ["3", "7"], to: "3" }
      - { from: ["4", "8"], to: "4" }
    pattern: { type: mesh, per_pair: 1 }

  - name: t1-t2                   # each T1 round-robins over T2 1-3 of each T2 plane
    from: { group: t1, key: "\${plane}", ports: up }
    to:   { group: t2, filters: { plane.index: 1-3 }, ports: down }
    pattern: { type: round-robin, per_pair: 2 }

# 2. PHYSICAL (device_labels) and 3. MAPPING (mapping) follow; the diagram shows the virtual part only.
`;
