// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';


// Helper to throw errors
// This is so we can avoid importing errors.js, to avoid a import loop
function throw_error(message) {
    if(globalThis.libWrapper)
        throw new globalThis.libWrapper.LibWrapperInternalError(message);
    else
        throw new Error(message);
}


// game.users polyfill, so it can be used before 'ready'
export const game_user_data = function(return_null=false) {
    // Try game.user.data first
    const orig_game_user_data = game?.user?.data;
    if(orig_game_user_data)
        return orig_game_user_data;

    // Grab the user ID
    const userid = game.userId ?? game.data.userId;
    if(!userid) {
        if(return_null)
            return null;
        throw_error("Unable to obtain the current user ID");
    }

    // Find user in game.data.users
    const user_data = game.data.users.find((x) => { return x._id == userid });
    if(!user_data) {
        if(return_null)
            return null;
        throw_error("Unable to obtain the current user data object");
    }

    // Done
    return user_data;
}

// game.user.can polyfill, so it can be used before 'ready'
export const game_user_can = function(action, return_null=false) {
    // Try game.user.can first
    const orig_game_user_can = game?.user?.can;
    if(orig_game_user_can)
        return orig_game_user_can(action);

    // Obtain game.user.data
    const user_data = game_user_data(return_null);
    if(!user_data)
        return null;

    // Check if user is GM
    if(user_data.role === 4)
        return true;

    // Check if the action is in the per-user permissions
    if(action in user_data.permissions) return user_data.permissions[action];

    // Otherwise, check the role's permissions
    const game_permissions_str = game.data.settings.find((x) => { return x.key === 'core.permissions'});
    if(game_permissions_str?.value) {
        const game_permissions = JSON.parse(game_permissions_str.value);

        const rolePerms = game_permissions[action];
        if(rolePerms && rolePerms.includes(user_data.role))
            return true;
    }

    return false;
}

// game.user.isGM polyfill, so it can be used before 'ready'
export const game_user_isGM = function(return_null=false) {
    // Try game.user.isGM first
    const orig_game_user_isGM = game?.user?.isGM;
    if(orig_game_user_isGM !== undefined)
        return orig_game_user_isGM;

    // Obtain game.user.data
    const user_data = game_user_data(return_null);
    if(!user_data)
        return null;

    // Done
    return user_data.role === 4;
}