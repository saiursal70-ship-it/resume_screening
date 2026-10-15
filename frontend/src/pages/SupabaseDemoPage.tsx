import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { Link } from 'react-router-dom';

interface Todo {
  id: string | number;
  name?: string;
  title?: string;
  [key: string]: any;
}

export default function SupabaseDemoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getTodos() {
      if (!isSupabaseConfigured) {
        setError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file to enable Supabase integration.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data, error } = await supabase.from('todos').select();
        if (error) {
          setError(error.message);
        } else if (data) {
          setTodos(data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch from Supabase');
      } finally {
        setLoading(false);
      }
    }

    getTodos();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white">Supabase Integration Test</h1>
            <p className="text-sm text-slate-400">Querying <code className="text-emerald-400">todos</code> table from Supabase</p>
          </div>
          <Link
            to="/jobs"
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition"
          >
            &larr; Back to HR Platform
          </Link>
        </div>

        {loading && (
          <div className="p-4 bg-slate-800/60 rounded-lg text-slate-300">
            Connecting to Supabase and loading todos...
          </div>
        )}

        {error && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm mb-4">
            <p className="font-semibold">Supabase Note / Error:</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-xs text-slate-400">
              (Note: If the <code>todos</code> table does not exist in your Supabase project yet, create it in your Supabase Dashboard SQL editor).
            </p>
          </div>
        )}

        {!loading && !error && todos.length === 0 && (
          <div className="p-6 bg-slate-800/40 border border-slate-800 rounded-lg text-center text-slate-400">
            <p>Connected to Supabase successfully, but the <code>todos</code> table is currently empty.</p>
          </div>
        )}

        <ul className="space-y-2">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className="p-3 bg-slate-800 rounded-lg border border-slate-700/60 flex items-center justify-between"
            >
              <span className="font-medium text-slate-200">{todo.name || todo.title || JSON.stringify(todo)}</span>
              <span className="text-xs text-slate-500 font-mono">ID: {todo.id}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

