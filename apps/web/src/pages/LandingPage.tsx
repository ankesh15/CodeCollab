import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Code2,
  Users,
  MessageSquare,
  Trophy,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Menu,
  X,
  Shield,
  Zap,
  Play,
  ChevronRight,
  Github,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col justify-between">
      {/* 1. PUBLIC NAVBAR */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* LEFT: Logo */}
          <Link to="/" className="flex items-center gap-2.5 text-slate-900 hover:opacity-90 transition-opacity">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Code2 className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">CodeCollab</span>
          </Link>

          {/* CENTER: Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">
              How it works
            </a>
            <Link to="/problems" className="hover:text-indigo-600 transition-colors">
              Problems
            </Link>
          </div>

          {/* RIGHT: Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* MOBILE MENU TOGGLE */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* MOBILE MENU DROPDOWN */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 shadow-md">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-slate-700 hover:text-indigo-600 py-2"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-slate-700 hover:text-indigo-600 py-2"
            >
              How it works
            </a>
            <Link
              to="/problems"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-slate-700 hover:text-indigo-600 py-2"
            >
              Problems
            </Link>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-xl"
              >
                Get Started →
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 space-y-24 py-12">
        {/* 2. HERO SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold tracking-wide uppercase shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Real-Time Developer Collaboration</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight">
            Code together.{' '}
            <span className="text-indigo-600 inline-block">
              Solve together.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 font-normal max-w-2xl mx-auto leading-relaxed">
            Collaborate on coding problems in real time with shared editing, secure execution, chat, and developer analytics.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-md transition-all active:scale-95 text-sm sm:text-base"
            >
              <span>Start Coding</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              to="/problems"
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold px-6 py-3.5 rounded-xl shadow-xs transition-colors text-sm sm:text-base"
            >
              <span>Explore Problems</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Real-time editing
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Secure execution
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Team collaboration
            </span>
          </div>

          {/* 3. HERO PRODUCT PREVIEW & 4. FLOATING PRODUCT DETAILS */}
          <div className="pt-6 max-w-5xl mx-auto relative">
            {/* Floating Badge 1 (Top Left) */}
            <div className="hidden lg:flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-lg absolute -top-2 -left-4 z-20 text-xs font-semibold text-slate-800 animate-bounce">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>3 collaborators online</span>
            </div>

            {/* Floating Badge 2 (Top Right) */}
            <div className="hidden lg:flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-lg absolute top-12 -right-4 z-20 text-xs font-semibold text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Code synced</span>
            </div>

            {/* Floating Badge 3 (Bottom Right) */}
            <div className="hidden lg:flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-lg absolute -bottom-4 right-12 z-20 text-xs font-semibold text-slate-800">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Accepted
              </span>
              <span className="font-mono text-slate-500">42 ms • 12 MB</span>
            </div>

            {/* Browser/IDE Container Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-left relative z-10">
              {/* Window Header */}
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span className="ml-3 font-mono text-slate-600 font-bold">CodeCollab — Room: Algo-Masterclass</span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-emerald-700 font-semibold font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>● 3 collaborators</span>
                </div>
              </div>

              {/* Grid Content Mockup */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[340px]">
                {/* Left Problem Column */}
                <div className="md:col-span-4 p-4 border-r border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Two Sum</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      EASY
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                    Given an array of integers <code className="text-indigo-600">nums</code> and an integer <code className="text-indigo-600">target</code>, return indices of the two numbers such that they add up to target.
                  </p>
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sample Output:</span>
                    <pre className="text-[10px] font-mono bg-white p-2 rounded border border-slate-200 text-indigo-700 mt-1">
                      [0, 1]
                    </pre>
                  </div>
                </div>

                {/* Right Monaco Code Preview */}
                <div className="md:col-span-8 p-4 bg-slate-900 font-mono text-xs text-slate-200 leading-relaxed space-y-1 overflow-x-auto">
                  <div>
                    <span className="text-slate-600 select-none mr-4">1</span>
                    <span className="text-purple-400">#include</span> <span className="text-emerald-300">&lt;bits/stdc++.h&gt;</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">2</span>
                    <span className="text-purple-400">using namespace</span> <span className="text-cyan-300">std</span>;
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">3</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">4</span>
                    <span className="text-blue-400">vector</span>&lt;<span className="text-blue-400">int</span>&gt; <span className="text-yellow-300">twoSum</span>(<span className="text-blue-400">vector</span>&lt;<span className="text-blue-400">int</span>&gt;&amp; nums, <span className="text-blue-400">int</span> target) {'{'}
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">5</span>
                    <span className="pl-4 text-slate-400">// Real-time collaborative Monaco editor workspace</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">6</span>
                    <span className="pl-4">unordered_map&lt;<span className="text-blue-400">int</span>, <span className="text-blue-400">int</span>&gt; mp;</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">7</span>
                    <span className="pl-4"><span className="text-purple-400">for</span> (<span className="text-blue-400">int</span> i = 0; i &lt; nums.size(); i++) {'{'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">8</span>
                    <span className="pl-8"><span className="text-purple-400">if</span> (mp.count(target - nums[i])) <span className="text-purple-400">return</span> {'{'}mp[target - nums[i]], i{'}'};</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">9</span>
                    <span className="pl-8">mp[nums[i]] = i;</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">10</span>
                    <span className="pl-4">{'}'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">11</span>
                    <span className="pl-4"><span className="text-purple-400">return</span> {'{}'};</span>
                  </div>
                  <div>
                    <span className="text-slate-600 select-none mr-4">12</span>
                    {'}'}
                  </div>
                </div>
              </div>

              {/* Bottom Member Bar Footer */}
              <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Alex (Owner)
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Sarah (Admin)
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Michael (Member)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 rounded">
                    ▶ Run
                  </span>
                  <span className="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded">
                    Submit
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. SOCIAL / TRUST STRIP */}
        <section className="bg-white border-y border-slate-200 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              BUILT FOR COLLABORATIVE PROBLEM SOLVING
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-bold text-slate-700">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-600" /> Real-Time Collaboration
              </span>
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" /> Secure Execution
              </span>
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" /> Developer Analytics
              </span>
            </div>
          </div>
        </section>

        {/* 6. FEATURES SECTION */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Features</h2>
            <p className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
              Everything you need to code together.
            </p>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
              From shared editing to secure execution, CodeCollab brings the entire collaborative coding workflow into one workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 01 */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  01
                </span>
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Real-Time Collaboration</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                See your teammates' edits and presence as they happen with instant socket synchronization.
              </p>
            </div>

            {/* Feature 02 */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  02
                </span>
                <Code2 className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Collaborative Editor</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Work together inside a shared Monaco-powered coding environment with cursor synchronization.
              </p>
            </div>

            {/* Feature 03 */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                  03
                </span>
                <Play className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Secure Code Execution</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Run solutions through a sandboxed execution environment with test metrics and runtime limits.
              </p>
            </div>

            {/* Feature 04 */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100">
                  04
                </span>
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Room Chat</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Discuss approaches without leaving the workspace using integrated real-time room chat.
              </p>
            </div>

            {/* Feature 05 */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">
                  05
                </span>
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Analytics</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Track submissions, acceptance rates, difficulty breakdowns, and 30-day activity logs.
              </p>
            </div>

            {/* Feature 06 */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                  06
                </span>
                <Trophy className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Leaderboards</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Compare progress and celebrate consistent problem solving with global and room member rankings.
              </p>
            </div>
          </div>
        </section>

        {/* 7. HOW IT WORKS */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Workflow</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              From idea to accepted solution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {/* Step 1 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center mx-auto text-sm">
                01
              </div>
              <h3 className="text-sm font-bold text-slate-900">Create or join a room</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Start a private room with password or join public study rooms.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center mx-auto text-sm">
                02
              </div>
              <h3 className="text-sm font-bold text-slate-900">Choose a problem</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Select an algorithmic problem from the library.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center mx-auto text-sm">
                03
              </div>
              <h3 className="text-sm font-bold text-slate-900">Code together</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sync edits instantly with presence and live cursors.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center mx-auto text-sm">
                04
              </div>
              <h3 className="text-sm font-bold text-slate-900">Run and submit</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Evaluate against public and hidden test cases in sandbox.
              </p>
            </div>

            {/* Step 5 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center mx-auto text-sm">
                05
              </div>
              <h3 className="text-sm font-bold text-slate-900">Track your progress</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Review runtime metrics, solved counts, and ranks.
              </p>
            </div>
          </div>
        </section>

        {/* 8. COLLABORATION SHOWCASE */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Description */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                <Users className="w-3.5 h-3.5" />
                <span>Live Multiplayer Editing</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
                One workspace.{' '}
                <span className="text-indigo-600">Everyone in sync.</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                No more copy-pasting code snippets across messaging apps. CodeCollab synchronizes every keystroke, cursor movement, and document state in real time across all room members.
              </p>

              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Shared Monaco editor with version conflict protection</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Live line & column cursor indicators per developer</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Integrated room chat for technical discussion</span>
                </li>
              </ul>
            </div>

            {/* Right Collaboration Mockup */}
            <div className="lg:col-span-7 bg-slate-900 rounded-2xl p-5 font-mono text-xs text-slate-300 space-y-2 border border-slate-800 shadow-xl overflow-x-auto">
              <div className="text-slate-500 pb-2 border-b border-slate-800 flex items-center justify-between text-[11px]">
                <span>● Algo-Masterclass / solution.cpp</span>
                <span className="text-emerald-400">✓ Version 14 (Synced)</span>
              </div>

              <div>
                <span className="text-slate-600 mr-4">11</span>
                <span className="text-purple-400">for</span> (<span className="text-blue-400">int</span> i = 0; i &lt; n; i++) {'{'}
              </div>
              <div className="relative bg-indigo-950/60 p-1 rounded border-l-2 border-indigo-500">
                <span className="text-slate-600 mr-4">12</span>
                <span className="pl-4">
                  if (target == nums[i]) return i;{' '}
                  <span className="bg-indigo-600 text-white font-sans text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs ml-1">
                    Alex L12:C5
                  </span>
                </span>
              </div>
              <div>
                <span className="text-slate-600 mr-4">13</span>
                <span className="pl-4">{'}'}</span>
              </div>
              <div className="relative bg-emerald-950/60 p-1 rounded border-l-2 border-emerald-500">
                <span className="text-slate-600 mr-4">24</span>
                <span className="pl-4">
                  cout &lt;&lt; <span className="text-emerald-300">"Test passed!"</span>;{' '}
                  <span className="bg-emerald-600 text-white font-sans text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs ml-1">
                    Sarah L24:C8
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 9. SECURE EXECUTION SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Sandboxed Code Runner</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Code execution without the guesswork.
            </p>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
              Run your solution against test cases and receive clear execution results including status, runtime and memory usage.
            </p>
          </div>

          <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 rounded-lg text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Accepted
              </span>
              <span className="text-xs font-mono text-slate-600">5 / 5 Test Cases Passed</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Runtime</span>
                <span className="text-sm font-extrabold text-slate-900 font-mono">42 ms</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Memory</span>
                <span className="text-sm font-extrabold text-slate-900 font-mono">12 MB</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Test Cases</span>
                <span className="text-sm font-extrabold text-emerald-600 font-mono">5 / 5</span>
              </div>
            </div>
          </div>
        </section>

        {/* 10. PROBLEM LIBRARY PREVIEW */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Problem Library</h2>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Practice with purpose.</p>
            </div>
            <Link
              to="/problems"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Explore Problem Library</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">Two Sum</h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                    EASY
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  Find two numbers in an array that add up to a specific target sum.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono text-[11px]">3 Test Cases</span>
                <Link to="/problems" className="font-bold text-indigo-600 hover:underline flex items-center gap-1">
                  <span>Open Problem</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">Reverse Linked List</h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                    EASY
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  Reverse a singly linked list iteratively or recursively.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono text-[11px]">3 Test Cases</span>
                <Link to="/problems" className="font-bold text-indigo-600 hover:underline flex items-center gap-1">
                  <span>Open Problem</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">Valid Parentheses</h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                    MEDIUM
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  Determine if an input string containing brackets is valid.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono text-[11px]">3 Test Cases</span>
                <Link to="/problems" className="font-bold text-indigo-600 hover:underline flex items-center gap-1">
                  <span>Open Problem</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>



        {/* 12. FINAL CTA */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl text-white relative overflow-hidden">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Ready to code together?</h2>
            <p className="text-indigo-100 text-sm sm:text-base max-w-xl mx-auto font-normal">
              Create a room, invite your teammates, and start solving problems together.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                to="/register"
                className="flex items-center gap-2 bg-white hover:bg-slate-100 text-indigo-700 font-bold px-6 py-3.5 rounded-xl shadow-md transition-all text-sm active:scale-95"
              >
                <span>Start Coding</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/problems"
                className="bg-indigo-700/60 hover:bg-indigo-700 border border-indigo-400/40 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors text-sm"
              >
                <span>Explore Problems</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 13. MINIMAL PUBLIC FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-10 text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 font-bold text-slate-900">
              <div className="p-1 bg-indigo-600 text-white rounded-md">
                <Code2 className="w-4 h-4" />
              </div>
              <span>CodeCollab</span>
            </div>
            <p className="text-slate-500 text-[11px]">Real-time collaborative coding for developers.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-4">
              <a href="#features" className="hover:text-indigo-600 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">
                How it works
              </a>
              <Link to="/problems" className="hover:text-indigo-600 transition-colors">
                Problems
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/problems" className="hover:text-indigo-600 transition-colors">
                Documentation
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-indigo-600 transition-colors flex items-center gap-1"
              >
                <Github className="w-3.5 h-3.5" /> GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
