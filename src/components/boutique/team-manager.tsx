'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, api } from '@/lib/client/api';
import { STORE_ROLE_LABELS } from '@/lib/boutique/rbac';
import { Badge, Button, Card, Field, inputClass } from '@/components/ui';

type StoreRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'SALESPERSON' | 'STOCK_MANAGER' | 'ACCOUNTANT';
type AssignableRole = Exclude<StoreRole, 'OWNER'>;

const ASSIGNABLE_ROLES: AssignableRole[] = [
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'SALESPERSON',
  'STOCK_MANAGER',
  'ACCOUNTANT',
];

const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  ADMIN: 'Gère la boutique, les réglages et toute l’équipe (sauf le propriétaire).',
  MANAGER: 'Accès large : produits, stock, achats, ventes, clients, finances.',
  CASHIER: 'Accès à la caisse, aux ventes et aux clients uniquement.',
  SALESPERSON: 'Vend en caisse et gère la fiche des clients.',
  STOCK_MANAGER: 'Gère les produits, le stock, les achats et les fournisseurs.',
  ACCOUNTANT: 'Consulte les ventes et gère les finances, dépenses et crédits.',
};

type Member = {
  id: string;
  role: StoreRole;
  extraPermissions: string[];
  userId: string;
  name: string;
  email: string;
  lastLoginAt: string | null;
};

export function StoreTeamManager({
  members,
  canManage,
  currentUserId,
  permissions,
  rolePermissions,
}: {
  members: Member[];
  canManage: boolean;
  currentUserId: string;
  permissions: Array<{ value: string; label: string }>;
  rolePermissions: Record<AssignableRole, string[]>;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [role, setRole] = useState<AssignableRole>('CASHIER');
  const [extras, setExtras] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function startAdding() {
    setAdding(true);
    setEditing(null);
    setRole('CASHIER');
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
        await api.patch(`/api/boutique/team/${editing.id}`, { role, extraPermissions: extras });
      } else {
        await api.post('/api/boutique/team', {
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
      await api.delete(`/api/boutique/team/${member.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Le membre n'a pas pu être retiré.");
    } finally {
      setPending(false);
    }
  }

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
                <input id="email" name="email" type="email" required className={inputClass} />
              </Field>
            </>
          )}

          <fieldset>
            <legend className="text-sm font-medium">Rôle</legend>
            <div className="mt-2 space-y-1.5">
              {ASSIGNABLE_ROLES.map((value) => (
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
                    <span className="block font-medium">{STORE_ROLE_LABELS[value]}</span>
                    <span className="block text-ink-muted">{ROLE_DESCRIPTIONS[value]}</span>
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
                    {included && <span className="text-xs text-ink-faint">(incluse)</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={pending}>
              Enregistrer
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
          <h2 className="text-sm font-medium">Membres</h2>
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
                    {STORE_ROLE_LABELS[member.role]}
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
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(member)}>
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
