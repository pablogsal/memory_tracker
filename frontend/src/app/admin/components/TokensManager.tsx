"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Key, Power, PowerOff, Trash2 } from "lucide-react";
import api from "@/lib/api";
import type { AuthToken, TokenAnalytics } from "@/lib/types";

export default function TokensManager() {
  const [tokens, setTokens] = useState<AuthToken[]>([]);
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tokensData, analyticsData] = await Promise.all([
        api.getTokens(),
        api.getTokenAnalytics()
      ]);
      setTokens(tokensData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Error",
        description: "Failed to load token data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleToggleTokenActive = async (token: AuthToken) => {
    try {
      if (token.is_active) {
        await api.deactivateToken(token.id);
      } else {
        await api.activateToken(token.id);
      }
      setTokens(prev => prev.map(t => 
        t.id === token.id ? { ...t, is_active: !t.is_active } : t
      ));
      loadData(); // Refresh analytics
      toast({
        title: "Success",
        description: `Token ${token.is_active ? 'deactivated' : 'activated'} successfully`,
      });
    } catch (error) {
      console.error('Failed to toggle token:', error);
      toast({
        title: "Error",
        description: "Failed to update token status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteToken = async (token: AuthToken) => {
    if (!confirm(`Are you sure you want to delete the token "${token.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteToken(token.id);
      setTokens(prev => prev.filter(t => t.id !== token.id));
      loadData(); // Refresh analytics
      toast({
        title: "Success",
        description: "Token deleted successfully",
      });
    } catch (error) {
      console.error('Failed to delete token:', error);
      toast({
        title: "Error",
        description: "Failed to delete token",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Authentication Tokens</h2>
          <p className="text-muted-foreground">Manage API authentication tokens for worker processes</p>
        </div>
        <Button>Create Token</Button>
      </div>

      <div className="grid gap-4">
        {tokens.map((token) => (
          <Card key={token.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Key className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">{token.name}</CardTitle>
                    {token.description && (
                      <p className="text-sm text-muted-foreground">{token.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs ${token.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {token.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleTokenActive(token)}
                      title={token.is_active ? "Deactivate token" : "Activate token"}
                    >
                      {token.is_active ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteToken(token)}
                      title="Delete token"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Token Preview</p>
                  <code className="font-mono">{token.token_preview}</code>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(token.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Used</p>
                  <p>{token.last_used ? formatDate(token.last_used) : "Never"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {tokens.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No authentication tokens found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first token to enable worker authentication
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {analytics && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Token Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.total_tokens}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Tokens</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{analytics.active_tokens}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inactive Tokens</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{analytics.inactive_tokens}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ever Used</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.used_tokens}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Never Used</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{analytics.never_used_tokens}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Used Recently</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{analytics.recent_active_tokens}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}