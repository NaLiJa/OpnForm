<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Exceptions\ThrottleRequestsException;

class ProfileController extends Controller
{
    /**
     * Update the user's profile information.
     *
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $this->validate($request, [
            'name' => 'required',
            'email' => 'required|email|unique:users,email,' . $user->id,
        ]);

        // Check if email is actually changing
        $emailChanged = strtolower($request->email) !== strtolower($user->email);

        // Apply throttling only if email is changing
        if ($emailChanged) {
            $key = 'profilechange:' . $user->id;
            $attempts = RateLimiter::attempts($key);

            if ($attempts >= 2) {
                throw new ThrottleRequestsException('Too Many Attempts.');
            }

            RateLimiter::hit($key, 3600); // 1 hour
        }

        return tap($user)->update([
            'name' => $request->name,
            'email' => strtolower($request->email),
        ]);
    }

    // For self-hosted mode, only admin can update their credentials
    public function updateAdminCredentials(Request $request)
    {
        $request->validate([
            'email' => 'required|email|not_in:admin@opnform.com',
            'password' => 'required|min:6|confirmed|not_in:password',
        ], [
            'email.not_in' => "Please provide email address other than 'admin@opnform.com'",
            'password.not_in' => "Please another password other than 'password'."
        ]);

        $user = $request->user();
        $user->update([
            'email' => $request->email,
            'password' => bcrypt($request->password),
        ]);

        Cache::forget('initial_user_setup_complete');
        Cache::forget('max_user_id');

        $workspace = Workspace::create([
            'name' => 'My Workspace',
            'icon' => '🧪',
        ]);

        $user->workspaces()->sync([
            $workspace->id => [
                'role' => 'admin',
            ],
        ], false);

        return $this->success([
            'message' => 'Congratulations, your account credentials have been updated successfully.',
            'user' => $user,
        ]);
    }
}
