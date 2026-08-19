'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { ROLE_LABELS } from '@/lib/rbac';
import { Badge, Button, Card, Field, inputClass } from '@/components/ui';

type Member = {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'EMPLOYEE' | 'COURIER';
  extraPermissions: string[];
  userId: string;
  name: string;
  email: string;
  lastLoginAt: string | null;
};

/**
 * Gestion de l'équipe.
 *
 * Les permissions supplémentaires accordées à une personne s'ajoutent à celles
 * de son rôle : le système reste extensible sans multiplier les rôles.
 */
export function TeamManager({
  members,
  canManage,
  currentUserId,
  maxUsers,
  permissions,
  rolePermissions,
}: {
  members: Member[];
  canManage: boolean;
  currentUserId: string;
  maxUsers?: number;
  permissions: Array<{ value: string; label: string }>;
  rolePermissions: Record<'ADMIN' | 'EMPLOYEE' | 'COURIER', string[]>;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'EMPLOYEE' | 'COURIER'>('EMPLOYEE');
  const [extras, setExtras] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function startAdding() {
    setAdding(true);
    setEditing(null);
    setRole('EMPLOYEE');
    setExtras([]);
    setError(null);
    setFieldErrors({});
  }

  function startEditing(member: Member) {
    setEditing(member);
    setAdding(false);
    setRole(member.role === 'OWNER' ? 'ADMIN' : member.role);
    setExtras(member.extraPermissions);
    setError(null);
    setFieldErrors({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      if (editing) {
        await api.patch(`/api/equipe/${editing.id}`, { role, extraPermissions: extras });
      } else {
        await api.post('/api/equipe', {
          name: String(formData.get('name') ?? ''),
          email: String(formData.get('email') ?? ''),
          role,
          extraPermissions: extras,
        });
      }
      setAdding(false);
      setEditing(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("Le membre n'a pas pu être enregistré.");
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(member: Member) {
    if (
      !window.confirm(
        `Retirer ${member.name} de l'équipe ? Son compte Magyapro n'est pas supprimé.`,
      )
    ) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      await api.delete(`/api/equipe/${member.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le membre n'a pas pu être retiré.");
    } finally {
      setPending(false);
    }
  }

  // Les permissions déjà couvertes par le rôle sont montrées cochées et
  // désactivées : les proposer comme « supplément » serait trompeur.
  const includedByRole = new Set(rolePermissions[role]);

  if (adding || editing) {
    return (
      <Card className="p-5">
        <h2 className="text-lg font-medium">
          {editing ? `Modifier ${editing.name}` : "Ajouter un membre à l'équipe"}
        </h2>

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!editing && (
            <>
              <Field label="Nom" htmlFor="name" required error={fieldErrors.name}>
                <input id="name" name="name" required className={inputClass} />
              </Field>

              <Field
                label="Adresse email"
                htmlFor="email"
                required
                hint="La personne recevra un email pour définir son mot de passe."
                error={fieldErrors.email}
              >
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={inputClass}
                />
              </Field>
            </>
          )}

          <fieldset>
            <legend className="text-sm font-medium">Rôle</legend>
            <div className="mt-2 space-y-1.5">
              {(['ADMIN', 'EMPLOYEE', 'COURIER'] as const).map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-border px-4 py-3 text-sm hover:border-ink"
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={role === value}
                    onChange={() => {
                      setRole(value);
                      setExtras([]);
                    }}
                    className="mt-0.5 h-4 w-4 accent-ink"
                  />
                  <span>
                    <span className="block font-medium">{ROLE_LABELS[value]}</span>
                    <span className="block text-ink-muted">
                      {value === 'ADMIN' &&
                        'Gère le restaurant, le menu, les commandes et les réglages.'}
                      {value === 'EMPLOYEE' &&
                        'Consulte le menu et traite les commandes du service.'}
                      {value === 'COURIER' &&
                        "Espace dédié, limité aux livraisons — n'accède à rien d'autre."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Permissions supplémentaires</legend>
            <p className="mt-1 text-xs text-ink-muted">
              À accorder au cas par cas, en plus de celles du rôle.
            </p>

            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {permissions.map((permission) => {
                const included = includedByRole.has(permission.value);
                return (
                  <label
                    key={permission.value}
                    className="flex items-center gap-2.5 text-sm text-ink-muted"
                  >
                    <input
                      type="checkbox"
                      disabled={included}
                      checked={included || extras.includes(permission.value)}
                      onChange={(event) =>
                        setExtras((current) =>
                          event.target.checked
                            ? [...current, permission.value]
                            : current.filter((value) => value !== permission.value),
                        )
                      }
                      className="h-4 w-4 accent-ink"
                    />
                    {permission.label}
                    {included && (
                      <span className="text-xs text-ink-faint">(incluse)</span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            Membres
            {maxUsers !== undefined && maxUsers > 0 && (
              <span className="ml-2 font-normal text-ink-faint">
                {members.length} / {maxUsers}
              </span>
            )}
          </h2>
          {canManage && (
            <Button size="sm" onClick={startAdding}>
              Ajouter un membre
            </Button>
          )}
        </div>

        <ul className="mt-4 divide-y divide-surface-border">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {member.name}
                  <Badge tone={member.role === 'OWNER' ? 'brand' : 'neutral'}>
                    {ROLE_LABELS[member.role]}
                  </Badge>
                  {member.userId === currentUserId && (
                    <span className="text-xs text-ink-faint">(vous)</span>
                  )}
                </p>
                <p className="mt-0.5 break-all text-sm text-ink-muted">{member.email}</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {member.lastLoginAt
                    ? `Dernière connexion le ${new Date(member.lastLoginAt).toLocaleDateString('fr-FR')}`
                    : 'Jamais connecté'}
                  {member.extraPermissions.length > 0 &&
                    ` · ${member.extraPermissions.length} permission${member.extraPermissions.length > 1 ? 's' : ''} supplémentaire${member.extraPermissions.length > 1 ? 's' : ''}`}
                </p>
              </div>

              {canManage && member.role !== 'OWNER' && (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => startEditing(member)}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => remove(member)}
                  >
                    Retirer
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
