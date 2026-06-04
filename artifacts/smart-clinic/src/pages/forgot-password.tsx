import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
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
import { Activity, ArrowLeft, CheckCircle2 } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

export default function ForgotPassword() {
  const { toast } = useToast();
  const forgotPasswordMutation = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof forgotPasswordSchema>) {
    try {
      await forgotPasswordMutation.mutateAsync({ data: values });
      setSubmitted(true);
    } catch {
      toast({
        variant: "destructive",
        title: "Request failed",
        description: "Could not send reset email. Please try again.",
      });
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-lg border-primary/10">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              If an account with that email address exists, we've sent a password reset link. The link expires in 30 minutes.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn't receive it? Check your spam folder or{" "}
              <button
                className="text-primary hover:underline font-medium"
                onClick={() => setSubmitted(false)}
              >
                try again
              </button>.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full mt-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
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
            Forgot Password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="doctor@clinic.com"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full font-medium"
                disabled={forgotPasswordMutation.isPending}
                data-testid="button-submit-forgot"
              >
                {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline inline-flex items-center gap-1" data-testid="link-back-login">
              <ArrowLeft className="h-3 w-3" />
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
