import { Link, useNavigate } from 'react-router-dom';
import { CandidateForm } from '../candidates/CandidateForm';

export function CandidateFormPage() {
  const navigate = useNavigate();
  return <div className="coord-page candidate-form-page">
    <header className="coord-page-heading">
      <h1><Link to="/coordenador/candidatos">Candidatos e participantes</Link> <span aria-hidden="true">&gt;</span> Cadastrar candidato</h1>
    </header>
    <section className="study-form-panel candidate-form-panel" aria-labelledby="candidate-form-title">
      <div className="study-form-heading"><h2 id="candidate-form-title">Informações do candidato</h2></div>
      {/* S2-W2-06: fornecer o estado da consulta autorizada e onSubmit após existir uma API de candidatos.
          /studies é exclusivo do Pesquisador; /users é exclusivo do Administrador. */}
      <CandidateForm studies={{ status: 'unavailable', message: 'Não foi possível carregar os estudos disponíveis para vinculação.' }} onCancel={() => navigate('/coordenador/candidatos')} />
    </section>
  </div>;
}
