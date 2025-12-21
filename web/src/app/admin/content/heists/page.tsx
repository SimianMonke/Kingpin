'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type HeistTab = 'trivia' | 'riddles' | 'quickgrab';

interface TriviaItem {
  id: number;
  category: string;
  question: string;
  answer: string;
  alternateAnswers: string[];
  timesUsed: number;
  isActive: boolean;
}

interface RiddleItem {
  id: number;
  riddle: string;
  answer: string;
  alternateAnswers: string[];
  timesUsed: number;
  isActive: boolean;
}

interface QuickGrabItem {
  id: number;
  phrase: string;
  timesUsed: number;
  isActive: boolean;
}

export default function HeistsContentPage() {
  const [activeTab, setActiveTab] = useState<HeistTab>('trivia');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/content" className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-2xl uppercase tracking-widest text-amber-500">
          Heist Content
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-primary)]/20 pb-2">
        {(['trivia', 'riddles', 'quickgrab'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 font-display text-xs uppercase tracking-wider transition-colors rounded-t',
              activeTab === tab
                ? 'bg-amber-500 text-black'
                : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
            )}
          >
            {tab === 'quickgrab' ? 'Quick-Grab' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'trivia' && <TriviaTab />}
      {activeTab === 'riddles' && <RiddlesTab />}
      {activeTab === 'quickgrab' && <QuickGrabTab />}
    </div>
  );
}

// =============================================================================
// TRIVIA TAB
// =============================================================================

function TriviaTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    question: '',
    answer: '',
    alternateAnswers: '',
  });

  const { data, isLoading } = useQuery<{ success: boolean; data: { items: TriviaItem[]; categories: { name: string; count: number }[] } }>({
    queryKey: ['admin-heist-trivia'],
    queryFn: async () => {
      const res = await fetch('/api/admin/content/heists/trivia');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await fetch('/api/admin/content/heists/trivia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: payload.category,
          question: payload.question,
          answer: payload.answer,
          alternateAnswers: payload.alternateAnswers.split(',').map(a => a.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-trivia'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: typeof formData & { id: number; isActive?: boolean }) => {
      const res = await fetch('/api/admin/content/heists/trivia', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          category: payload.category,
          question: payload.question,
          answer: payload.answer,
          alternateAnswers: payload.alternateAnswers.split(',').map(a => a.trim()).filter(Boolean),
          isActive: payload.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-trivia'] });
      resetForm();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch('/api/admin/content/heists/trivia', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-trivia'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/content/heists/trivia?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-trivia'] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ category: '', question: '', answer: '', alternateAnswers: '' });
  };

  const handleEdit = (item: TriviaItem) => {
    setEditingId(item.id);
    setFormData({
      category: item.category,
      question: item.question,
      answer: item.answer,
      alternateAnswers: item.alternateAnswers.join(', '),
    });
    setShowForm(true);
  };

  if (isLoading) {
    return <div className="text-center py-8 font-mono text-[var(--color-muted)]">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        {data?.data.categories.map(cat => (
          <div key={cat.name} className="bg-[var(--color-surface)] px-3 py-2 rounded">
            <p className="font-display text-xs uppercase text-amber-500">{cat.name}</p>
            <p className="font-mono text-sm">{cat.count} questions</p>
          </div>
        ))}
      </div>

      {/* Add Button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)}>
          <PlusIcon className="w-4 h-4 mr-2" /> Add Trivia
        </Button>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Trivia' : 'Add Trivia'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingId) {
                  updateMutation.mutate({ id: editingId, ...formData });
                } else {
                  createMutation.mutate(formData);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Category</label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g., general, gaming, movies"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Answer</label>
                  <Input
                    value={formData.answer}
                    onChange={(e) => setFormData(f => ({ ...f, answer: e.target.value }))}
                    placeholder="The correct answer"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Question</label>
                <Input
                  value={formData.question}
                  onChange={(e) => setFormData(f => ({ ...f, question: e.target.value }))}
                  placeholder="Enter the trivia question"
                  required
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                  Alternate Answers (comma separated)
                </label>
                <Input
                  value={formData.alternateAnswers}
                  onChange={(e) => setFormData(f => ({ ...f, alternateAnswers: e.target.value }))}
                  placeholder="alt1, alt2, alt3"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-primary)]/20">
                <th className="text-left p-4 font-display text-xs uppercase">Category</th>
                <th className="text-left p-4 font-display text-xs uppercase">Question</th>
                <th className="text-left p-4 font-display text-xs uppercase">Answer</th>
                <th className="text-center p-4 font-display text-xs uppercase">Used</th>
                <th className="text-center p-4 font-display text-xs uppercase">Status</th>
                <th className="text-right p-4 font-display text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--color-primary)]/10 last:border-0">
                  <td className="p-4 font-mono text-xs">
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-500 rounded">{item.category}</span>
                  </td>
                  <td className="p-4 font-mono text-sm max-w-xs truncate">{item.question}</td>
                  <td className="p-4 font-mono text-xs text-[var(--color-muted)]">{item.answer}</td>
                  <td className="p-4 text-center font-mono text-xs">{item.timesUsed}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-display uppercase',
                        item.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-400 hover:text-blue-300 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this trivia question?')) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// RIDDLES TAB
// =============================================================================

function RiddlesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    riddle: '',
    answer: '',
    alternateAnswers: '',
  });

  const { data, isLoading } = useQuery<{ success: boolean; data: { items: RiddleItem[] } }>({
    queryKey: ['admin-heist-riddles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/content/heists/riddles');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await fetch('/api/admin/content/heists/riddles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riddle: payload.riddle,
          answer: payload.answer,
          alternateAnswers: payload.alternateAnswers.split(',').map(a => a.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-riddles'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: typeof formData & { id: number }) => {
      const res = await fetch('/api/admin/content/heists/riddles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          riddle: payload.riddle,
          answer: payload.answer,
          alternateAnswers: payload.alternateAnswers.split(',').map(a => a.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-riddles'] });
      resetForm();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch('/api/admin/content/heists/riddles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-riddles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/content/heists/riddles?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-riddles'] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ riddle: '', answer: '', alternateAnswers: '' });
  };

  const handleEdit = (item: RiddleItem) => {
    setEditingId(item.id);
    setFormData({
      riddle: item.riddle,
      answer: item.answer,
      alternateAnswers: item.alternateAnswers.join(', '),
    });
    setShowForm(true);
  };

  if (isLoading) {
    return <div className="text-center py-8 font-mono text-[var(--color-muted)]">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-[var(--color-muted)]">
          {data?.data.items.length || 0} riddles total
        </p>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <PlusIcon className="w-4 h-4 mr-2" /> Add Riddle
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Riddle' : 'Add Riddle'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingId) {
                  updateMutation.mutate({ id: editingId, ...formData });
                } else {
                  createMutation.mutate(formData);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Riddle</label>
                <Input
                  value={formData.riddle}
                  onChange={(e) => setFormData(f => ({ ...f, riddle: e.target.value }))}
                  placeholder="Enter the riddle"
                  required
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">Answer</label>
                <Input
                  value={formData.answer}
                  onChange={(e) => setFormData(f => ({ ...f, answer: e.target.value }))}
                  placeholder="The correct answer"
                  required
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--color-muted)] mb-1">
                  Alternate Answers (comma separated)
                </label>
                <Input
                  value={formData.alternateAnswers}
                  onChange={(e) => setFormData(f => ({ ...f, alternateAnswers: e.target.value }))}
                  placeholder="alt1, alt2"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-primary)]/20">
                <th className="text-left p-4 font-display text-xs uppercase">Riddle</th>
                <th className="text-left p-4 font-display text-xs uppercase">Answer</th>
                <th className="text-center p-4 font-display text-xs uppercase">Used</th>
                <th className="text-center p-4 font-display text-xs uppercase">Status</th>
                <th className="text-right p-4 font-display text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--color-primary)]/10 last:border-0">
                  <td className="p-4 font-mono text-sm max-w-md">{item.riddle}</td>
                  <td className="p-4 font-mono text-xs text-[var(--color-muted)]">{item.answer}</td>
                  <td className="p-4 text-center font-mono text-xs">{item.timesUsed}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-display uppercase',
                        item.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleEdit(item)} className="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
                    <button
                      onClick={() => { if (confirm('Delete this riddle?')) deleteMutation.mutate(item.id); }}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// QUICK-GRAB TAB
// =============================================================================

function QuickGrabTab() {
  const queryClient = useQueryClient();
  const [newPhrase, setNewPhrase] = useState('');

  const { data, isLoading } = useQuery<{ success: boolean; data: { items: QuickGrabItem[] } }>({
    queryKey: ['admin-heist-quickgrab'],
    queryFn: async () => {
      const res = await fetch('/api/admin/content/heists/quickgrab');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (phrase: string) => {
      const res = await fetch('/api/admin/content/heists/quickgrab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-quickgrab'] });
      setNewPhrase('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch('/api/admin/content/heists/quickgrab', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-quickgrab'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/content/heists/quickgrab?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-heist-quickgrab'] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 font-mono text-[var(--color-muted)]">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add Form */}
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newPhrase.trim()) createMutation.mutate(newPhrase.trim());
            }}
            className="flex gap-4"
          >
            <Input
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              placeholder="Enter quick-grab phrase (max 50 chars)"
              maxLength={50}
              className="flex-1"
            />
            <Button type="submit" disabled={createMutation.isPending || !newPhrase.trim()}>
              <PlusIcon className="w-4 h-4 mr-2" /> Add
            </Button>
          </form>
          {createMutation.isError && (
            <p className="text-red-400 font-mono text-xs mt-2">{(createMutation.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>{data?.data.items.length || 0} Quick-Grab Phrases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
            {data?.data.items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded border',
                  item.isActive
                    ? 'border-[var(--color-primary)]/20 bg-[var(--color-surface)]'
                    : 'border-red-500/20 bg-red-500/5'
                )}
              >
                <div>
                  <p className="font-mono text-sm">{item.phrase}</p>
                  <p className="font-mono text-[10px] text-[var(--color-muted)]">
                    Used {item.timesUsed} times
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                    className={cn(
                      'w-8 h-8 rounded flex items-center justify-center',
                      item.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    )}
                    title={item.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {item.isActive ? <CheckIcon className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this phrase?')) deleteMutation.mutate(item.id); }}
                    className="w-8 h-8 rounded bg-[var(--color-void)] text-[var(--color-muted)] hover:text-red-400 flex items-center justify-center"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// ICONS
// =============================================================================

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
