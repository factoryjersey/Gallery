import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

interface DBConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  tablePrefix: string;
  importCustomPostTypes: boolean;
  importCustomFields: boolean;
  importACF: boolean;
}

export default function WordPressDBMigration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState<DBConfig>({
    host: 'localhost',
    port: '3306',
    database: '',
    username: '',
    password: '',
    tablePrefix: 'wp_',
    importCustomPostTypes: true,
    importCustomFields: true,
    importACF: false,
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/import/wordpress-db/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Connection test failed');
      }
      
      return response.json();
    },
    onMutate: () => {
      setTestStatus('testing');
    },
    onSuccess: () => {
      setTestStatus('success');
      toast({
        title: "Connection Successful",
        description: "WordPress database connection verified",
      });
    },
    onError: (error: any) => {
      setTestStatus('error');
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/import/wordpress-db/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Migration failed');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      toast({
        title: "Migration Completed",
        description: `Imported ${result.results.articles} articles, ${result.results.categories} categories`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Migration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card data-testid="wordpress-db-migration">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="h-5 w-5 mr-2" />
          WordPress Database Migration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert data-testid="db-migration-warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This feature connects directly to your WordPress MySQL database to import posts, custom post types, and metadata.
            <strong className="block mt-2">Note:</strong> This requires your WordPress database to be accessible from this server. For security,
            use a read-only database user.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="db-host">Database Host</Label>
            <Input
              id="db-host"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              placeholder="localhost"
              data-testid="input-db-host"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="db-port">Port</Label>
            <Input
              id="db-port"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: e.target.value })}
              placeholder="3306"
              data-testid="input-db-port"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="db-name">Database Name</Label>
          <Input
            id="db-name"
            value={config.database}
            onChange={(e) => setConfig({ ...config, database: e.target.value })}
            placeholder="wordpress_db"
            data-testid="input-db-name"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="db-username">Username</Label>
            <Input
              id="db-username"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              placeholder="wp_user"
              data-testid="input-db-username"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="db-password">Password</Label>
            <Input
              id="db-password"
              type="password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              placeholder="••••••••"
              data-testid="input-db-password"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="table-prefix">Table Prefix</Label>
          <Input
            id="table-prefix"
            value={config.tablePrefix}
            onChange={(e) => setConfig({ ...config, tablePrefix: e.target.value })}
            placeholder="wp_"
            data-testid="input-table-prefix"
          />
        </div>

        <div className="space-y-3">
          <Label>Import Options</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="import-cpt"
                checked={config.importCustomPostTypes}
                onCheckedChange={(checked) => 
                  setConfig({ ...config, importCustomPostTypes: checked as boolean })
                }
                data-testid="checkbox-custom-post-types"
              />
              <label htmlFor="import-cpt" className="text-sm">
                Import Custom Post Types
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="import-cf"
                checked={config.importCustomFields}
                onCheckedChange={(checked) => 
                  setConfig({ ...config, importCustomFields: checked as boolean })
                }
                data-testid="checkbox-custom-fields"
              />
              <label htmlFor="import-cf" className="text-sm">
                Import Custom Fields & Post Meta
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="import-acf"
                checked={config.importACF}
                onCheckedChange={(checked) => 
                  setConfig({ ...config, importACF: checked as boolean })
                }
                data-testid="checkbox-acf"
              />
              <label htmlFor="import-acf" className="text-sm">
                Import Advanced Custom Fields (ACF)
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => testConnectionMutation.mutate()}
            variant="outline"
            disabled={testConnectionMutation.isPending || !config.database || !config.username}
            data-testid="button-test-connection"
          >
            {testConnectionMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : testStatus === 'success' ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Connected
              </>
            ) : (
              'Test Connection'
            )}
          </Button>

          <Button
            onClick={() => migrateMutation.mutate()}
            disabled={
              migrateMutation.isPending || 
              testStatus !== 'success' || 
              !config.database || 
              !config.username
            }
            data-testid="button-start-migration"
          >
            {migrateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Migrating...
              </>
            ) : (
              'Start Migration'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
