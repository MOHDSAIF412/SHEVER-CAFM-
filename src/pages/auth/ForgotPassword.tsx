import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSent(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 space-y-6">
          <div>
            <Link to="/login" className="inline-flex items-center text-xs text-teal-400 hover:underline mb-3">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Login</span>
            </Link>
            <h2 className="text-xl font-bold text-white">Reset Password</h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter your corporate email address to receive password reset instructions.
            </p>
          </div>

          {sent ? (
            <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl text-teal-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
              <span>Password reset link has been dispatched to your email.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@shever.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition-colors"
              >
                Send Reset Instructions
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
