<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class WorkspaceResource extends JsonResource
{
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        return array_merge(parent::toArray($request), [
            'max_file_size' => $this->max_file_size / 1000000,
            'is_readonly' => $this->isReadonlyUser($request->user()),
            'is_admin' => $this->isAdminUser($request->user()),
            'users_count' => $this->users_count,
        ]);
    }
}
