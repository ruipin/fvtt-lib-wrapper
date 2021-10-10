// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

// Object that contains the error classes that libWrapper should use.
// This is used to avoid cyclic dependencies, and is what should be imported by files outside the 'errors' folder.
export const ERRORS = {
    base              : Error,
    internal          : Error,
    package           : Error,
    already_overridden: Error,
    invalid_chain     : Error
};
Object.seal(ERRORS);