"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";
import { getLocalEntries } from "@/lib/indexedDb";

// ============================================================
// Mind Palace Page — Dynamic Force-Directed Correlation Network
// ============================================================

interface Node {
  id: string;
  type: "habit" | "theme" | "emotion";
  label: string;
  icon: string;
  val: number;
  // Physics properties
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  extra?: any;
}

interface Link {
  source: string; // Node ID
  target: string; // Node ID
  value: number; // Correlation coefficient r
  type: string;
  label: string;
  // Resolved node refs for rendering
  sourceNode?: Node;
  targetNode?: Node;
}

const EMOTION_COLORS: Record<string, string> = {
  determined: "#6366f1", // Indigo
  calm: "#10b981", // Emerald
  anxious: "#f59e0b", // Amber
  frustrated: "#ef4444", // Red
  joyful: "#ec4899", // Pink
  low: "#6b7280", // Gray
  neutral: "#94a3b8", // Slate
};

export default function PalacePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Data states
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Selection states
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);

  // Interaction / Zoom & Pan state
  const [transform, setTransform] = useState({ x: 0, y: 0, zoom: 1 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNode = useRef<Node | null>(null);

  // 1. Fetch data (API with offline IndexedDB fallback)
  const loadCorrelations = useCallback(async () => {
    setLoading(true);
    setSelectedNode(null);
    try {
      const tzOffset = new Date().getTimezoneOffset();
      
      let data: any = null;
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const res = await fetch(`/api/correlations?tzOffset=${tzOffset}`);
          if (res.ok) {
            data = await res.json();
            setIsOfflineMode(false);
          }
        } catch (apiErr) {
          console.warn("API correlation query failed, falling back to local computation:", apiErr);
        }
      }

      // Offline local computation fallback
      if (!data) {
        const localEntries = await getLocalEntries();
        const activeEntries = localEntries.filter(e => !e.deleted_at);

        // Fetch local items and compute basic theme correlations
        const computed = computeLocalCorrelations(activeEntries);
        data = computed;
        setIsOfflineMode(true);
        toast.info("Offline: Displaying Mind Palace correlations computed from local cache.");
      }

      if (data && data.success) {
        // Initialize node physics placement in a circle
        const width = containerRef.current?.clientWidth || window.innerWidth;
        const height = 450;
        const centerX = width / 2;
        const centerY = height / 2;

        const initializedNodes = (data.nodes || []).map((node: any, idx: number) => {
          const angle = (idx / data.nodes.length) * Math.PI * 2;
          const radius = 120 + Math.random() * 40;
          return {
            ...node,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
            radius: Math.max(16, 12 + Math.sqrt(node.val) * 4), // Radius proportional to occurrences
          };
        });

        // Resolve link source/target to node objects
        const resolvedLinks = (data.links || []).map((link: any) => {
          const sourceNode = initializedNodes.find((n: Node) => n.id === link.source);
          const targetNode = initializedNodes.find((n: Node) => n.id === link.target);
          return {
            ...link,
            sourceNode,
            targetNode,
          };
        }).filter((l: Link) => l.sourceNode && l.targetNode);

        setNodes(initializedNodes);
        setLinks(resolvedLinks);
        
        // Reset view transform to center
        setTransform({ x: 0, y: 0, zoom: 1 });
      } else {
        toast.error("Failed to load correlation data.");
      }
    } catch (err) {
      console.error("PalacePage loading error:", err);
      toast.error("An error occurred loading the Mind Palace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCorrelations();
  }, [loadCorrelations]);

  // Compute correlation locally if API is unreachable
  const computeLocalCorrelations = (entries: any[]) => {
    // Generate 30 days
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }

    const entriesByDay: Record<string, any[]> = {};
    entries.forEach(e => {
      const date = e.created_at.split("T")[0];
      if (!entriesByDay[date]) entriesByDay[date] = [];
      entriesByDay[date].push(e);
    });

    const dayProfiles = days.map(day => {
      const dayEntries = entriesByDay[day] || [];
      const hasCheckin = dayEntries.length > 0;
      let avgTone = 0;
      let avgEnergy = 0;
      let domEmotion: string | null = null;
      const themes = new Set<string>();

      if (hasCheckin) {
        let totalTone = 0;
        let totalEnergy = 0;
        dayEntries.forEach(e => {
          totalTone += e.tone_score || 5;
          totalEnergy += e.energy_level || 5;
          const cbtThemes = e.cbt_data?.themes;
          if (Array.isArray(cbtThemes)) {
            cbtThemes.forEach((t: string) => themes.add(t.toLowerCase()));
          }
        });
        avgTone = totalTone / dayEntries.length;
        avgEnergy = totalEnergy / dayEntries.length;
        domEmotion = dayEntries[dayEntries.length - 1].dominant_emotion || "neutral";
      }

      return {
        day,
        hasCheckin,
        tone: avgTone,
        energy: avgEnergy,
        dominantEmotion: domEmotion,
        themes,
      };
    });

    // Identify active themes & emotions
    const activeThemes = new Set<string>();
    const activeEmotions = new Set<string>();
    dayProfiles.forEach(p => {
      p.themes.forEach(t => activeThemes.add(t));
      if (p.dominantEmotion) activeEmotions.add(p.dominantEmotion);
    });

    const nodes: any[] = [];
    const links: any[] = [];

    // Add Theme nodes
    const themeEmojis: Record<string, string> = {
      work: "💼", caffeine: "☕", health: "🏋️", sleep: "😴",
      family: "👨‍👩‍👧‍👦", friends: "👥", money: "💵", meditation: "🧘", hobbies: "🎨"
    };

    activeThemes.forEach(t => {
      const occurrences = dayProfiles.filter(p => p.themes.has(t)).length;
      nodes.push({
        id: `theme:${t}`,
        type: "theme",
        label: t.charAt(0).toUpperCase() + t.slice(1),
        icon: themeEmojis[t] || "🏷️",
        val: occurrences * 2,
        extra: { themeName: t, occurrences }
      });
    });

    // Add Emotion nodes
    const EMOTION_EMOJIS: Record<string, string> = {
      determined: "⚡", calm: "🌊", anxious: "😰", frustrated: "😤", joyful: "✨", low: "🔋", neutral: "😐"
    };
    activeEmotions.forEach(e => {
      const occurrences = dayProfiles.filter(p => p.dominantEmotion === e).length;
      nodes.push({
        id: `emotion:${e}`,
        type: "emotion",
        label: e.charAt(0).toUpperCase() + e.slice(1),
        icon: EMOTION_EMOJIS[e] || "🎭",
        val: occurrences * 2,
        extra: { emotionName: e, occurrences }
      });
    });

    const getPearson = (x: number[], y: number[]) => {
      const n = x.length;
      if (n === 0) return 0;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += x[i]; sumY += y[i]; sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
      }
      const num = n * sumXY - sumX * sumY;
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      return den === 0 ? 0 : num / den;
    };

    // Theme & Emotion links
    activeThemes.forEach(t => {
      activeEmotions.forEach(e => {
        const checkinDays = dayProfiles.filter(p => p.hasCheckin);
        const x = checkinDays.map(p => p.themes.has(t) ? 1 : 0);
        const y = checkinDays.map(p => p.dominantEmotion === e ? 1 : 0);
        const r = getPearson(x, y);
        if (Math.abs(r) >= 0.1) {
          links.push({
            source: `theme:${t}`,
            target: `emotion:${e}`,
            value: parseFloat(r.toFixed(3)),
            type: "theme_emotion",
            label: `${r > 0 ? "+" : ""}${r.toFixed(2)} correlation`
          });
        }
      });
    });

    // Calculate metadata correlations
    nodes.forEach(node => {
      if (node.type === "theme" && node.extra) {
        const tName = node.extra.themeName;
        const checkinDays = dayProfiles.filter(p => p.hasCheckin);
        const themeVector = checkinDays.map(p => p.themes.has(tName) ? 1 : 0);
        const toneVector = checkinDays.map(p => p.tone);
        const energyVector = checkinDays.map(p => p.energy);

        node.extra.toneCorrelation = parseFloat(getPearson(themeVector, toneVector).toFixed(3));
        node.extra.energyCorrelation = parseFloat(getPearson(themeVector, energyVector).toFixed(3));
      }
    });

    return {
      success: true,
      nodes,
      links
    };
  };

  // 2. Physics Simulation Loop
  useEffect(() => {
    if (loading || nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frameCount = 0;

    // Simulation Constants
    const REPULSION = 280;
    const SPRING_LENGTH = 140;
    const SPRING_STRENGTH = 0.05;
    const GRAVITY = 0.03;
    const DAMPING = 0.82;

    const updatePhysics = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // A. Node Repulsion (push nodes away)
      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j];
          const dx = nodeA.x - nodeB.x;
          const dy = nodeA.y - nodeB.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (dist < 280) {
            const force = (REPULSION * 25) / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (nodeA !== draggedNode.current) {
              nodeA.vx += fx;
              nodeA.vy += fy;
            }
            if (nodeB !== draggedNode.current) {
              nodeB.vx -= fx;
              nodeB.vy -= fy;
            }
          }
        }
      }

      // B. Link Spring Pull (pull connected nodes together)
      links.forEach((link) => {
        const s = link.sourceNode;
        const t = link.targetNode;
        if (!s || !t) return;

        const dx = s.x - t.x;
        const dy = s.y - t.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Force proportional to distance delta and correlation strength
        const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH * (0.5 + Math.abs(link.value) * 1.5);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (s !== draggedNode.current) {
          s.vx -= fx;
          s.vy -= fy;
        }
        if (t !== draggedNode.current) {
          t.vx += fx;
          t.vy += fy;
        }
      });

      // C. Center Gravity & Bounds boundary push
      nodes.forEach((node) => {
        if (node === draggedNode.current) return;

        // Pull to center
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        node.vx += (dx / dist) * GRAVITY * 1.2;
        node.vy += (dy / dist) * GRAVITY * 1.2;

        // Update velocity and position
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;

        // Keep inside bounds with 35px padding
        node.x = Math.max(35, Math.min(width - 35, node.x));
        node.y = Math.max(35, Math.min(height - 35, node.y));
      });
    };

    const drawScene = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear with dark space color
      ctx.fillStyle = "#0c0c16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Apply Zoom & Pan
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.zoom, transform.zoom);

      // Draw Grid Pattern behind elements
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      const gridSize = 45;
      for (let x = -width * 2; x < width * 3; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -height * 2);
        ctx.lineTo(x, height * 3);
        ctx.stroke();
      }
      for (let y = -height * 2; y < height * 3; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-width * 2, y);
        ctx.lineTo(width * 3, y);
        ctx.stroke();
      }

      // A. Render Links
      links.forEach((link) => {
        const s = link.sourceNode;
        const t = link.targetNode;
        if (!s || !t) return;

        const isHighlighted = 
          selectedNode?.id === s.id || 
          selectedNode?.id === t.id ||
          hoveredNode?.id === s.id ||
          hoveredNode?.id === t.id;

        // Determine link color based on positive/negative correlation
        let strokeColor = "rgba(148, 163, 184, 0.15)"; // neutral grey
        if (link.value > 0.15) {
          strokeColor = isHighlighted ? "rgba(16, 185, 129, 0.8)" : "rgba(16, 185, 129, 0.35)"; // green
        } else if (link.value < -0.15) {
          strokeColor = isHighlighted ? "rgba(239, 68, 68, 0.8)" : "rgba(239, 68, 68, 0.35)"; // red
        }

        ctx.strokeStyle = strokeColor;
        // Width proportional to correlation value
        ctx.lineWidth = Math.max(1, 1.2 + Math.abs(link.value) * 5.5);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();

        // Animated traversal dot for active connections
        if (Math.abs(link.value) >= 0.2) {
          const speed = 0.008 * (1 + Math.abs(link.value) * 2);
          const progress = (frameCount * speed) % 1.0;
          
          // Animate forward for positive, reverse for negative correlation
          const p = link.value > 0 ? progress : (1.0 - progress);
          const dotX = s.x + (t.x - s.x) * p;
          const dotY = s.y + (t.y - s.y) * p;

          ctx.fillStyle = link.value > 0 ? "#34d399" : "#f87171";
          ctx.beginPath();
          ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // B. Render Nodes
      nodes.forEach((node) => {
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;

        // Establish core color
        let color = "#ffffff";
        if (node.type === "emotion") {
          color = EMOTION_COLORS[node.label.toLowerCase()] || EMOTION_COLORS.neutral;
        } else if (node.type === "habit") {
          color = "#6366f1"; // Indigo
        } else if (node.type === "theme") {
          color = "#06b6d4"; // Cyan
        }

        ctx.save();

        // Neon Glow shadow
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected || isHovered ? 20 : 6;

        // Dynamic scale bounce on selection/hover
        const r = node.radius * (isSelected ? 1.2 : isHovered ? 1.1 : 1.0);

        // Circular background filling
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected 
          ? color 
          : isHovered 
            ? "rgba(30, 41, 59, 0.9)" 
            : "rgba(15, 23, 42, 0.75)";
        ctx.fill();

        // Thin Border Outline
        ctx.strokeStyle = isSelected ? "#ffffff" : color;
        ctx.lineWidth = isSelected ? 3.0 : 1.8;
        ctx.stroke();

        // Clear shadow
        ctx.shadowBlur = 0;

        // Render Emoji in center
        ctx.font = `${r * 0.9}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(node.icon || "⚙", node.x, node.y);

        // Render node label underneath
        ctx.font = isSelected ? "bold 11px Inter, sans-serif" : "500 10px Inter, sans-serif";
        ctx.fillStyle = isSelected ? "#ffffff" : "rgba(241, 245, 249, 0.85)";
        ctx.fillText(node.label, node.x, node.y + r + 14);

        ctx.restore();
      });

      ctx.restore();
    };

    const renderLoop = () => {
      frameCount++;
      updatePhysics();
      drawScene();
      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [loading, nodes, links, transform, selectedNode, hoveredNode]);

  // Handle window resizing
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    canvas.width = containerRef.current.clientWidth;
    canvas.height = 450;
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    handleResize(); // Initial setup
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [handleResize]);

  // Translate client mouse coordinates to canvas transform coordinates
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Reverse translate coordinates
    return {
      x: (x - transform.x) / transform.zoom,
      y: (y - transform.y) / transform.zoom,
    };
  };

  // 3. Mouse Event Listeners
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mousePos = getCanvasMousePos(e);

    // Check if clicked inside any node
    let clickedNode: Node | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = mousePos.x - node.x;
      const dy = mousePos.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= node.radius + 6) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      draggedNode.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      // Prepare canvas dragging
      isDraggingCanvas.current = true;
      dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNode.current) {
      const mousePos = getCanvasMousePos(e);
      draggedNode.current.x = mousePos.x;
      draggedNode.current.y = mousePos.y;
      draggedNode.current.vx = 0;
      draggedNode.current.vy = 0;
      return;
    }

    if (isDraggingCanvas.current) {
      setTransform({
        ...transform,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
      return;
    }

    // Handle Hover detection
    const mousePos = getCanvasMousePos(e);
    let matchedHover: Node | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = mousePos.x - node.x;
      const dy = mousePos.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= node.radius + 6) {
        matchedHover = node;
        break;
      }
    }
    setHoveredNode(matchedHover);
  };

  const handleMouseUp = () => {
    draggedNode.current = null;
    isDraggingCanvas.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.08;
    const factor = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const nextZoom = Math.max(0.4, Math.min(2.5, transform.zoom * factor));

    setTransform({
      x: mouseX - (mouseX - transform.x) * (nextZoom / transform.zoom),
      y: mouseY - (mouseY - transform.y) * (nextZoom / transform.zoom),
      zoom: nextZoom,
    });
  };

  const zoomIn = () => {
    setTransform(prev => ({
      ...prev,
      zoom: Math.min(2.5, prev.zoom * 1.2),
    }));
  };

  const zoomOut = () => {
    setTransform(prev => ({
      ...prev,
      zoom: Math.max(0.4, prev.zoom / 1.2),
    }));
  };

  const resetLayout = () => {
    loadCorrelations();
  };

  // Find related links/nodes for the drawer
  const getSelectedCorrelations = () => {
    if (!selectedNode) return [];
    
    return links
      .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
      .map(l => {
        const otherNode = l.source === selectedNode.id ? l.targetNode : l.sourceNode;
        return {
          node: otherNode,
          value: l.value,
          label: l.label,
        };
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  };

  const width = containerRef.current?.clientWidth || 400;

  return (
    <div className="flex flex-col space-y-4 pb-6 select-none max-w-lg mx-auto">
      
      {/* Dynamic Subheading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Mind Palace</h2>
          <p className="text-xs text-[var(--text-secondary)]">Habit-Emotion-Theme correlations network</p>
        </div>
        {isOfflineMode && (
          <Badge variant="nudge" className="animate-pulse">Offline mode</Badge>
        )}
      </div>

      {/* Main Canvas Workspace */}
      <div 
        ref={containerRef}
        className="relative w-full rounded-[var(--radius-lg)] border border-[rgba(255,255,255,0.08)] bg-[#0c0c16] overflow-hidden shadow-2xl"
        style={{ height: "450px" }}
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-[#0c0c16]/90 z-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-primary)] border-t-transparent" />
            <span className="text-xs text-[var(--text-secondary)] font-semibold">Constructing palace architecture...</span>
          </div>
        ) : nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#0c0c16]">
            <span className="text-3xl">🏺</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your Palace is Empty</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs leading-relaxed">
              Complete more daily reflections and habit logs over the coming days. The coach needs at least one data log to extract themes and establish Pearson correlation links.
            </p>
            <Button size="sm" onClick={resetLayout}>Refresh</Button>
          </div>
        ) : null}

        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="block w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Floating Controls */}
        <div className="absolute top-3 left-3 flex space-x-1.5 z-10">
          <button
            onClick={zoomIn}
            className="flex items-center justify-center h-7 w-7 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.08)] bg-[#1e293b]/70 hover:bg-[#1e293b] text-white text-xs font-bold transition-all shadow"
            title="Zoom In"
          >
            ➕
          </button>
          <button
            onClick={zoomOut}
            className="flex items-center justify-center h-7 w-7 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.08)] bg-[#1e293b]/70 hover:bg-[#1e293b] text-white text-xs font-bold transition-all shadow"
            title="Zoom Out"
          >
            ➖
          </button>
          <button
            onClick={resetLayout}
            className="flex items-center justify-center h-7 w-7 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.08)] bg-[#1e293b]/70 hover:bg-[#1e293b] text-white text-xs transition-all shadow"
            title="Recenter"
          >
            🔄
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 max-w-[80%] z-10">
          <span className="flex items-center gap-1 text-[9px] bg-slate-900/60 border border-slate-700/50 px-1.5 py-0.5 rounded-full text-slate-300">
            <span className="h-1.5 w-1.5 bg-[#6366f1] rounded-full" /> Habit
          </span>
          <span className="flex items-center gap-1 text-[9px] bg-slate-900/60 border border-slate-700/50 px-1.5 py-0.5 rounded-full text-slate-300">
            <span className="h-1.5 w-1.5 bg-[#06b6d4] rounded-full" /> Theme
          </span>
          <span className="flex items-center gap-1 text-[9px] bg-slate-900/60 border border-slate-700/50 px-1.5 py-0.5 rounded-full text-slate-300">
            <span className="h-1.5 w-1.5 bg-[#10b981] rounded-full" /> Emotion
          </span>
        </div>
      </div>

      {/* Sliding Glassmorphic Node Detail Panel */}
      {selectedNode ? (
        <Card className="glass relative p-5 border-[rgba(255,255,255,0.08)] bg-[rgba(30,41,59,0.35)] backdrop-blur-xl animate-fade-in space-y-4">
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-4 right-4 text-xs font-semibold text-[var(--text-muted)] hover:text-white cursor-pointer"
          >
            ✕ Close
          </button>

          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 bg-slate-800/40 rounded-[var(--radius-md)] border border-slate-700/40">
              {selectedNode.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{selectedNode.label}</h3>
                <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full border ${
                  selectedNode.type === "habit" 
                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" 
                    : selectedNode.type === "theme"
                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}>
                  {selectedNode.type}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Logged {selectedNode.extra?.occurrences || 0} times in rolling 30 days
              </p>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Metrics Displays */}
          {selectedNode.type === "habit" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/40 border border-slate-800/50 p-3 rounded-[var(--radius-md)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Completion Rate</span>
                  <span className="text-lg font-extrabold text-white">
                    {Math.round((selectedNode.extra?.completionRate || 0) * 100)}%
                  </span>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/50 p-3 rounded-[var(--radius-md)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Tone correlation</span>
                  <span className={`text-lg font-extrabold flex items-center ${
                    selectedNode.extra?.toneCorrelation > 0.15 
                      ? "text-emerald-400" 
                      : selectedNode.extra?.toneCorrelation < -0.15 
                        ? "text-rose-400" 
                        : "text-slate-400"
                  }`}>
                    {selectedNode.extra?.toneCorrelation > 0 ? "＋" : ""}
                    {selectedNode.extra?.toneCorrelation || "0.00"}
                  </span>
                </div>
              </div>

              {selectedNode.extra?.avgToneCompleted !== null && (
                <div className="bg-slate-900/30 p-3 rounded-[var(--radius-md)] border border-slate-800/40 text-xs leading-relaxed text-slate-300">
                  ⚡ Completing <strong>{selectedNode.label}</strong> matches an average check-in tone score of <strong className="text-white">{selectedNode.extra.avgToneCompleted}</strong> compared to <strong className="text-white">{selectedNode.extra.avgToneNotCompleted || "5.0"}</strong> on days missed (
                  <span className={selectedNode.extra.avgToneCompleted - (selectedNode.extra.avgToneNotCompleted || 5) >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {selectedNode.extra.avgToneCompleted - (selectedNode.extra.avgToneNotCompleted || 5) >= 0 ? "＋" : ""}
                    {(selectedNode.extra.avgToneCompleted - (selectedNode.extra.avgToneNotCompleted || 5)).toFixed(1)} change
                  </span>
                  ).
                </div>
              )}
            </div>
          )}

          {selectedNode.type === "theme" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/40 border border-slate-800/50 p-3 rounded-[var(--radius-md)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Tone correlation</span>
                  <span className={`text-lg font-extrabold flex items-center ${
                    selectedNode.extra?.toneCorrelation > 0.15 
                      ? "text-emerald-400" 
                      : selectedNode.extra?.toneCorrelation < -0.15 
                        ? "text-rose-400" 
                        : "text-slate-400"
                  }`}>
                    {selectedNode.extra?.toneCorrelation > 0 ? "＋" : ""}
                    {selectedNode.extra?.toneCorrelation || "0.00"}
                  </span>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/50 p-3 rounded-[var(--radius-md)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Energy correlation</span>
                  <span className={`text-lg font-extrabold flex items-center ${
                    selectedNode.extra?.energyCorrelation > 0.15 
                      ? "text-emerald-400" 
                      : selectedNode.extra?.energyCorrelation < -0.15 
                        ? "text-rose-400" 
                        : "text-slate-400"
                  }`}>
                    {selectedNode.extra?.energyCorrelation > 0 ? "＋" : ""}
                    {selectedNode.extra?.energyCorrelation || "0.00"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Links Correlation Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Strongest Correlations
            </h4>
            
            {getSelectedCorrelations().length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic">
                No active correlations detected. Log more logs to compile relationships.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {getSelectedCorrelations().map((corr, idx) => {
                  if (!corr.node) return null;
                  
                  const isPositive = corr.value > 0.15;
                  const isNegative = corr.value < -0.15;

                  return (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between bg-slate-900/20 border border-slate-800/20 p-2 rounded-[var(--radius-sm)] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{corr.node.icon}</span>
                        <span className="font-semibold text-slate-200">{corr.node.label}</span>
                        <span className="text-[9px] text-[var(--text-muted)] font-medium">({corr.node.type})</span>
                      </div>
                      
                      <span className={`font-mono font-bold ${
                        isPositive 
                          ? "text-emerald-400" 
                          : isNegative 
                            ? "text-rose-400" 
                            : "text-slate-400"
                      }`}>
                        {corr.value > 0 ? "＋" : ""}
                        {corr.value.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </Card>
      ) : (
        <Card className="p-4 border-[rgba(255,255,255,0.06)] bg-slate-900/10 text-center text-xs text-[var(--text-muted)] leading-relaxed">
          💡 Click and drag nodes around to explore the layout. Click any node to open the correlation panel and discover how your habits and diary themes impact your mood.
        </Card>
      )}

    </div>
  );
}
