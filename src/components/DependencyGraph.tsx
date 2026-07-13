/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DependencyGraph as GraphData } from '../types';

interface DependencyGraphProps {
  data: GraphData | null;
  selectedName: string;
  onSelectNode: (name: string, type: 'table' | 'view' | 'procedure') => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'table' | 'view' | 'procedure';
  schema: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'fk' | 'reference';
}

export default function DependencyGraph({ data, selectedName, onSelectNode }: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Clear previous SVG content
    const svgElement = d3.select(svgRef.current);
    svgElement.selectAll('*').remove();

    const width = 750;
    const height = 400;

    // Set SVG viewport
    svgElement
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%');

    // Create marker for directed arrows
    const defs = svgElement.append('defs');
    
    // Normal link marker (e.g. view referencing table)
    defs.append('marker')
      .attr('id', 'arrow-reference')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 24) // offset from target center so arrow doesn't hide under node
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#3b82f6'); // Blue for views/references

    // Foreign Key link marker
    defs.append('marker')
      .attr('id', 'arrow-fk')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 24)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#60a5fa'); // Light blue for FKs

    // Deep copy data as D3 modifies nodes and links in-place
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = data.links
      .filter((l) => {
        const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .map((l) => ({ ...l }));

    // Create a container group to allow panning and zooming
    const gContainer = svgElement.append('g').attr('class', 'graph-content');

    // Zoom and pan setup
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        gContainer.attr('transform', event.transform);
      });

    svgElement.call(zoomBehavior);

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(140)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // Render links
    const link = gContainer.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d) => (d.type === 'fk' ? '#60a5fa' : '#3b82f6'))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => (d.type === 'fk' ? 2 : 1.5))
      .attr('stroke-dasharray', (d) => (d.type === 'reference' ? '4,4' : 'none'))
      .attr('marker-end', (d) => `url(#arrow-${d.type})`);

    // Render nodes
    const node = gContainer.append('g')
      .attr('class', 'nodes')
      .selectAll('.node-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        onSelectNode(d.name, d.type);
      })
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      );

    // Add node background circle
    node.append('circle')
      .attr('r', 16)
      .attr('fill', (d) => {
        if (d.type === 'table') return '#1e3a8a'; // Dark blue background
        if (d.type === 'view') return '#1e1b4b'; // Dark indigo background
        return '#451a03'; // Dark amber background
      })
      .attr('stroke', (d) => {
        const isSelected = d.name === selectedName;
        if (isSelected) return '#60a5fa'; // Highlight with Sky/Blue
        if (d.type === 'table') return '#3b82f6'; // Blue
        if (d.type === 'view') return '#6366f1'; // Indigo
        return '#f59e0b'; // Amber
      })
      .attr('stroke-width', (d) => (d.name === selectedName ? 3 : 1.5))
      .attr('class', 'transition-all duration-200');

    // Add node text character (e.g., T for Table, V for View, P for Procedure)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('fill', (d) => {
        if (d.type === 'table') return '#93c5fd';
        if (d.type === 'view') return '#a5b4fc';
        return '#fcd34d';
      })
      .text((d) => d.type[0].toUpperCase());

    // Add Node Label (Text below or beside the circle)
    node.append('text')
      .attr('dx', 22)
      .attr('dy', '.35em')
      .attr('text-anchor', 'start')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace')
      .attr('fill', (d) => (d.name === selectedName ? '#ffffff' : '#8b949e'))
      .attr('font-weight', (d) => (d.name === selectedName ? 'bold' : 'normal'))
      .text((d) => d.name);

    // Node tooltips
    node.append('title')
      .text((d) => `[${d.type.toUpperCase()}] ${d.schema}.${d.name}`);

    // Update positions during force simulation ticks
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x || 0)
        .attr('y1', (d) => (d.source as GraphNode).y || 0)
        .attr('x2', (d) => (d.target as GraphNode).x || 0)
        .attr('y2', (d) => (d.target as GraphNode).y || 0);

      node.attr('transform', (d) => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    // Drag helper functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data, selectedName]);

  return (
    <div className="relative w-full h-[400px] border border-[#30363d] bg-[#0d1117] rounded-lg overflow-hidden flex flex-col justify-between">
      {/* Legend & Help Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-4 text-[10px] text-slate-500 font-semibold font-mono bg-[#0d1117]/80 p-2 rounded backdrop-blur-xs border border-[#30363d]/50">
        <span className="flex items-center space-x-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#3b82f6]"></span>
          <span>Tables</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#6366f1]"></span>
          <span>Views</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#f59e0b]"></span>
          <span>Procedures</span>
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-blue-400">● Selected</span>
      </div>

      <div className="absolute top-4 right-4 z-10 text-[9px] text-slate-600 font-mono select-none">
        Drag to reposition • Scroll to zoom • Click node to inspect
      </div>

      <svg ref={svgRef} id="svg_dependency_graph" className="flex-1 w-full h-full" />
    </div>
  );
}
