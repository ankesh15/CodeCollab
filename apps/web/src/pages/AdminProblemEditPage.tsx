import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  ProblemDifficulty,
  ProblemStatus,
  ProblemExample,
} from '@codecollab/shared';
import {
  fetchAdminProblemDetailsApi,
  createAdminProblemApi,
  updateAdminProblemApi,
  addTestCaseApi,
  updateTestCaseApi,
  deleteTestCaseApi,
  publishProblemApi,
  unpublishProblemApi,
} from '../lib/api';
import {
  ArrowLeft,
  Save,
  Globe,
  FileCode,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Lock,
  ExternalLink,
  AlertCircle,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';

interface LocalTestCase {
  id?: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  isNew?: boolean;
}

export const AdminProblemEditPage: React.FC = () => {
  const { problemId } = useParams<{ problemId: string }>();
  const isEditMode = Boolean(problemId);
  const navigate = useNavigate();

  // Loading & Global Error
  const [isLoading, setIsLoading] = useState<boolean>(isEditMode);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState<string>('');
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>('EASY');
  const [externalRating, setExternalRating] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [constraints, setConstraints] = useState<string>('');
  const [inputFormat, setInputFormat] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<string>('');

  // Source Metadata (Protected for Codeforces)
  const [source, setSource] = useState<'INTERNAL' | 'CODEFORCES'>('INTERNAL');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ProblemStatus>('DRAFT');

  // Examples State
  const [examples, setExamples] = useState<ProblemExample[]>([]);
  const [newExampleInput, setNewExampleInput] = useState<string>('');
  const [newExampleOutput, setNewExampleOutput] = useState<string>('');
  const [newExampleExplanation, setNewExampleExplanation] = useState<string>('');
  const [isAddingExample, setIsAddingExample] = useState<boolean>(false);

  // Test Cases State
  const [testCases, setTestCases] = useState<LocalTestCase[]>([]);
  const [testCaseModalOpen, setTestCaseModalOpen] = useState<boolean>(false);
  const [editingTestCaseIndex, setEditingTestCaseIndex] = useState<number | null>(null);
  const [modalInput, setModalInput] = useState<string>('');
  const [modalOutput, setModalOutput] = useState<string>('');
  const [modalIsHidden, setModalIsHidden] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Unsaved Changes Tracking
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load Existing Problem if Editing
  const loadProblem = useCallback(async () => {
    if (!problemId) return;
    try {
      setIsLoading(true);
      setError(null);
      const prob = await fetchAdminProblemDetailsApi(problemId);

      setTitle(prob.title);
      setDifficulty(prob.difficulty);
      setExternalRating(prob.externalRating ? String(prob.externalRating) : '');
      setTags(prob.tags || []);
      setDescription(prob.description || '');
      setConstraints(prob.constraints || '');
      setInputFormat(prob.inputFormat || '');
      setOutputFormat(prob.outputFormat || '');
      setSource(prob.source || 'INTERNAL');
      setSourceUrl(prob.sourceUrl || null);
      setStatus(prob.status || 'DRAFT');
      setExamples(prob.examples || []);

      if (prob.testCases) {
        setTestCases(
          prob.testCases.map((tc) => ({
            id: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
          }))
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load problem details.');
    } finally {
      setIsLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (isEditMode) {
      loadProblem();
    }
  }, [isEditMode, loadProblem]);

  // Unsaved Warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Tag Handlers
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
    setIsDirty(true);
  };

  // Example Handlers
  const handleAddExample = () => {
    if (!newExampleInput.trim() || !newExampleOutput.trim()) return;
    setExamples([
      ...examples,
      {
        input: newExampleInput.trim(),
        expectedOutput: newExampleOutput.trim(),
        explanation: newExampleExplanation.trim() || null,
      },
    ]);
    setNewExampleInput('');
    setNewExampleOutput('');
    setNewExampleExplanation('');
    setIsAddingExample(false);
    setIsDirty(true);
  };

  const handleRemoveExample = (index: number) => {
    setExamples(examples.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  // Test Case Modal Handlers
  const openAddTestCaseModal = () => {
    setEditingTestCaseIndex(null);
    setModalInput('');
    setModalOutput('');
    setModalIsHidden(false);
    setModalError(null);
    setTestCaseModalOpen(true);
  };

  const openEditTestCaseModal = (index: number) => {
    const tc = testCases[index];
    if (!tc) return;
    setEditingTestCaseIndex(index);
    setModalInput(tc.input);
    setModalOutput(tc.expectedOutput);
    setModalIsHidden(tc.isHidden);
    setModalError(null);
    setTestCaseModalOpen(true);
  };

  const handleSaveModalTestCase = async () => {
    if (!modalInput.trim() || !modalOutput.trim()) {
      setModalError('Both Input and Expected Output fields are required.');
      return;
    }

    try {
      setModalError(null);

      if (isEditMode && problemId) {
        if (editingTestCaseIndex !== null) {
          // Update existing test case in DB
          const tc = testCases[editingTestCaseIndex];
          if (tc && tc.id) {
            await updateTestCaseApi(tc.id, {
              input: modalInput,
              expectedOutput: modalOutput,
              isHidden: modalIsHidden,
            });
          }
        } else {
          // Add new test case to DB
          await addTestCaseApi(problemId, {
            input: modalInput,
            expectedOutput: modalOutput,
            isHidden: modalIsHidden,
          });
        }
        await loadProblem();
      } else {
        // Local create mode
        if (editingTestCaseIndex !== null) {
          const updated = [...testCases];
          if (updated[editingTestCaseIndex]) {
            updated[editingTestCaseIndex] = {
              ...updated[editingTestCaseIndex]!,
              input: modalInput,
              expectedOutput: modalOutput,
              isHidden: modalIsHidden,
            };
            setTestCases(updated);
          }
        } else {
          setTestCases([
            ...testCases,
            {
              input: modalInput,
              expectedOutput: modalOutput,
              isHidden: modalIsHidden,
              isNew: true,
            },
          ]);
        }
      }

      setTestCaseModalOpen(false);
      setIsDirty(true);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to save test case.');
    }
  };

  const handleDeleteTestCase = async (index: number) => {
    const tc = testCases[index];
    if (!tc) return;
    try {
      if (isEditMode && tc.id) {
        await deleteTestCaseApi(tc.id);
        await loadProblem();
      } else {
        setTestCases(testCases.filter((_, i) => i !== index));
      }
      setIsDirty(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete test case.');
    }
  };

  // Main Save / Publish Actions
  const handleSave = async (shouldPublish = false) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMsg(null);

      if (!title.trim()) {
        setError('Problem title is required.');
        return;
      }
      if (!description.trim()) {
        setError('Problem description is required.');
        return;
      }

      const ratingNum = externalRating.trim() ? parseInt(externalRating.trim(), 10) : null;

      let currentProbId = problemId;

      if (isEditMode && currentProbId) {
        await updateAdminProblemApi(currentProbId, {
          title: title.trim(),
          difficulty,
          externalRating: ratingNum,
          tags,
          description: description.trim(),
          constraints: constraints.trim(),
          inputFormat: inputFormat.trim(),
          outputFormat: outputFormat.trim(),
          examples,
        });
      } else {
        // Create problem
        currentProbId = await createAdminProblemApi({
          title: title.trim(),
          difficulty,
          externalRating: ratingNum,
          tags,
          description: description.trim(),
          constraints: constraints.trim(),
          inputFormat: inputFormat.trim(),
          outputFormat: outputFormat.trim(),
          examples,
          status: 'DRAFT',
        });

        // Add local test cases to newly created problem
        for (const tc of testCases) {
          await addTestCaseApi(currentProbId, {
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden,
          });
        }
      }

      if (shouldPublish) {
        try {
          await publishProblemApi(currentProbId);
          setSuccessMsg('Problem successfully published!');
          setStatus('PUBLISHED');
        } catch (pubErr: unknown) {
          setError(pubErr instanceof Error ? pubErr.message : 'Publish validation failed.');
          return;
        }
      } else {
        setSuccessMsg('Draft saved successfully!');
      }

      setIsDirty(false);

      if (!isEditMode && currentProbId) {
        navigate(`/admin/problems/${currentProbId}/edit`, { replace: true });
      } else {
        await loadProblem();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save problem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!problemId) return;
    try {
      setIsSaving(true);
      await unpublishProblemApi(problemId);
      setStatus('DRAFT');
      setSuccessMsg('Problem unpublished and reverted to Draft status.');
      await loadProblem();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish problem.');
    } finally {
      setIsSaving(false);
    }
  };

  // Test Case Counts
  const publicCount = testCases.filter((tc) => !tc.isHidden).length;
  const hiddenCount = testCases.filter((tc) => tc.isHidden).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow flex items-center justify-center p-12">
          <div className="text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-medium">Loading problem editor...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <Link
              to="/admin/problems"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin Problems
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {isEditMode ? `Edit Problem` : 'Create New Problem'}
              </h1>
              {status === 'PUBLISHED' ? (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                  Published
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                  Draft
                </span>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {status === 'PUBLISHED' ? (
              <button
                onClick={handleUnpublish}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                Unpublish
              </button>
            ) : null}

            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-500" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Publish Problem
            </button>
          </div>
        </div>

        {/* Global Notices */}
        {error && (
          <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">
              ×
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-4">
              ×
            </button>
          </div>
        )}

        {/* Codeforces Source Metadata Header Banner */}
        {source === 'CODEFORCES' && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Imported Codeforces Problem
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Source metadata (Source, ID, URL) is protected. You can add local CodeCollab test cases below.
                </p>
              </div>
            </div>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 transition-colors"
              >
                Open Original Problem <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Form Grid */}
        <div className="mt-6 space-y-6">
          {/* SECTION 1: Basic Information */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileCode className="w-5 h-5 text-indigo-600" />
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Problem Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Two Sum"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Difficulty *
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => {
                    setDifficulty(e.target.value as ProblemDifficulty);
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Rating */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  External Rating (Optional)
                </label>
                <input
                  type="number"
                  value={externalRating}
                  onChange={(e) => {
                    setExternalRating(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. 800 or 1400"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Tags Input */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Tags</span>
                  <span className="text-[10px] text-slate-400 font-normal">Press Enter or click Add Tag</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="e.g. arrays, hash-table, dp"
                    className="flex-grow px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                  >
                    Add Tag
                  </button>
                </div>

                {/* Tag Chips */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-rose-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: Problem Statement */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers className="w-5 h-5 text-indigo-600" />
              Problem Description & Formats
            </h2>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Description * (Markdown Supported)
              </label>
              <textarea
                rows={6}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Write clear problem statement detailing what the algorithm needs to accomplish..."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            {/* Constraints */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Constraints
              </label>
              <textarea
                rows={3}
                value={constraints}
                onChange={(e) => {
                  setConstraints(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="e.g. 1 <= nums.length <= 10^4&#10;-10^9 <= nums[i] <= 10^9"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Input Format */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Input Format
                </label>
                <textarea
                  rows={3}
                  value={inputFormat}
                  onChange={(e) => {
                    setInputFormat(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. First line contains N. Second line contains N space-separated integers."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Output Format */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Output Format
                </label>
                <textarea
                  rows={3}
                  value={outputFormat}
                  onChange={(e) => {
                    setOutputFormat(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. Print a single integer representing the answer."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Examples Builder */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Problem Examples
              </h2>
              <button
                type="button"
                onClick={() => setIsAddingExample(!isAddingExample)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingExample ? 'Cancel' : 'Add Example'}
              </button>
            </div>

            {/* Add New Example Form */}
            {isAddingExample && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  New Sample Example
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Input
                    </label>
                    <textarea
                      rows={2}
                      value={newExampleInput}
                      onChange={(e) => setNewExampleInput(e.target.value)}
                      placeholder="e.g. 2 7 11 15"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Expected Output
                    </label>
                    <textarea
                      rows={2}
                      value={newExampleOutput}
                      onChange={(e) => setNewExampleOutput(e.target.value)}
                      placeholder="e.g. 0 1"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-md text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Explanation (Optional)
                  </label>
                  <input
                    type="text"
                    value={newExampleExplanation}
                    onChange={(e) => setNewExampleExplanation(e.target.value)}
                    placeholder="e.g. Because nums[0] + nums[1] == 9, we return [0, 1]."
                    className="w-full p-2 bg-white border border-slate-200 rounded-md text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingExample(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddExample}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm"
                  >
                    Save Example
                  </button>
                </div>
              </div>
            )}

            {/* List Existing Examples */}
            {examples.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No sample examples added yet.
              </p>
            ) : (
              <div className="space-y-3">
                {examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative group"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveExample(idx)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Remove Example"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <p className="text-xs font-bold text-slate-800 mb-2">Example {idx + 1}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Input:</span>
                        <pre className="mt-1 p-2 bg-white rounded border border-slate-200 font-mono overflow-x-auto">
                          {ex.input}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Expected Output:</span>
                        <pre className="mt-1 p-2 bg-white rounded border border-slate-200 font-mono overflow-x-auto">
                          {ex.expectedOutput}
                        </pre>
                      </div>
                    </div>
                    {ex.explanation && (
                      <div className="mt-2 text-xs text-slate-600">
                        <span className="font-semibold">Explanation:</span> {ex.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: Test Case Builder */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Test Case Builder
                </h2>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    ✓ {publicCount} Public Tests
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold">
                    🔒 {hiddenCount} Hidden Tests
                  </span>
                  <span className="text-slate-500 font-medium">
                    Total: {testCases.length} Tests
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={openAddTestCaseModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                Add Test Case
              </button>
            </div>

            {/* Test Cases Table */}
            {testCases.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 border-dashed text-slate-500">
                <p className="text-xs font-semibold text-slate-700">No test cases configured</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  At least 1 Public and 1 Hidden test case are recommended before publishing.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase">
                      <th className="py-2.5 px-3 w-12">#</th>
                      <th className="py-2.5 px-3">Input</th>
                      <th className="py-2.5 px-3">Expected Output</th>
                      <th className="py-2.5 px-3">Visibility</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {testCases.map((tc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-800">
                          {tc.input.length > 50 ? `${tc.input.substring(0, 50)}...` : tc.input}
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-slate-800">
                          {tc.expectedOutput.length > 50
                            ? `${tc.expectedOutput.substring(0, 50)}...`
                            : tc.expectedOutput}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {tc.isHidden ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-bold">
                              <Lock className="w-3 h-3 text-slate-500" />
                              Hidden
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[11px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Public
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditTestCaseModal(idx)}
                              className="p-1 text-slate-500 hover:text-indigo-600 rounded transition-colors"
                              title="Edit Test Case"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTestCase(idx)}
                              className="p-1 text-slate-500 hover:text-rose-600 rounded transition-colors"
                              title="Delete Test Case"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Test Case Modal */}
      {testCaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingTestCaseIndex !== null ? 'Edit Test Case' : 'Add Test Case'}
              </h3>
              <button
                onClick={() => setTestCaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {modalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Input *
              </label>
              <textarea
                rows={3}
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="Enter exact raw input string..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expected Output *
              </label>
              <textarea
                rows={3}
                value={modalOutput}
                onChange={(e) => setModalOutput(e.target.value)}
                placeholder="Enter exact raw expected output string..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Visibility Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    !modalIsHidden
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    checked={!modalIsHidden}
                    onChange={() => setModalIsHidden(false)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-xs font-bold">Public Case</p>
                    <p className="text-[10px] opacity-80">Visible during "Run"</p>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    modalIsHidden
                      ? 'bg-slate-100 border-slate-300 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    checked={modalIsHidden}
                    onChange={() => setModalIsHidden(true)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-bold">Hidden Case</p>
                    <p className="text-[10px] opacity-80">Protected during "Submit"</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTestCaseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalTestCase}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Save Test Case
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
