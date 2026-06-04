import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation, Link } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, AlertCircle } from "lucide-react";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const resetPasswordMutation = useResetPassword();
  const [success, setSuccess] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token");

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-lg border-primary/10">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">Invalid Reset Link</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              This password reset link is invalid or missing. Please request a new one.
            </p>
            <Link href="/forgot-password">
              <Button className="w-full">Request New Reset Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-lg border-primary/10">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">Password Updated</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Your password has been successfully changed. You can now sign in with your new password.
            </p>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    try {
      await resetPasswordMutation.mutateAsync({ data: { token: token!, newPassword: values.newPassword } });
      setSuccess(true);
    } catch (error: any) {
      const msg = error?.response?.data?.error ?? "Could not reset password. The link may have expired.";
      toast({
        variant: "destructive",
        title: "Reset failed",
        description: msg,
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Set New Password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose a strong password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        data-testid="input-new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full font-medium"
                disabled={resetPasswordMutation.isPending}
                data-testid="button-submit-reset"
              >
                {resetPasswordMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline" data-testid="link-back-login">
              Sign in instead
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
